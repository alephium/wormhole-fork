package db

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/dgraph-io/badger/v3"
)

type Database struct {
	db *badger.DB
}

func VaaIDFromVAA(v *vaa.VAA) *vaa.VAAID {
	return &vaa.VAAID{
		EmitterChain:   v.EmitterChain,
		EmitterAddress: v.EmitterAddress,
		TargetChain:    v.TargetChain,
		Sequence:       v.Sequence,
	}
}

var (
	ErrVAANotFound = errors.New("requested VAA not found in store")
)

func Open(path string) (*Database, error) {
	db, err := badger.Open(badger.DefaultOptions(path))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	return &Database{
		db: db,
	}, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) StoreSignedVAA(v *vaa.VAA) error {
	if len(v.Signatures) == 0 {
		panic("StoreSignedVAA called for unsigned VAA")
	}

	b, _ := v.Marshal()

	// We allow overriding of existing VAAs, since there are multiple ways to
	// acquire signed VAA bytes. For instance, the node may have a signed VAA
	// via gossip before it reaches quorum on its own. The new entry may have
	// a different set of signatures, but the same VAA.
	//
	// TODO: panic on non-identical signing digest?

	err := d.db.Update(func(txn *badger.Txn) error {
		if err := txn.Set(VaaIDFromVAA(v).Bytes(), b); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to commit tx: %w", err)
	}

	return nil
}

type GovernanceVAA struct {
	TargetChain vaa.ChainID
	Sequence    uint64
	VaaBytes    []byte
}

func (d *Database) GetGovernanceVAABatch(governanceChainId vaa.ChainID, governanceEmitter vaa.Address, sequences []uint64) ([]*GovernanceVAA, error) {
	vaas := make([]*GovernanceVAA, 0)
	vaaId := &vaa.VAAID{
		EmitterChain:   governanceChainId,
		EmitterAddress: governanceEmitter,
	}
	contains := func(seq uint64) bool {
		for _, s := range sequences {
			if seq == s {
				return true
			}
		}
		return false
	}
	prefixBytes := vaaId.GovernanceEmitterPrefixBytes()
	if err := d.db.View(func(txn *badger.Txn) error {
		iteratorOpts := badger.DefaultIteratorOptions
		iteratorOpts.PrefetchValues = false
		iteratorOpts.Prefix = prefixBytes
		it := txn.NewIterator(iteratorOpts)
		defer it.Close()

		for it.Seek(prefixBytes); it.ValidForPrefix(prefixBytes); it.Next() {
			keyStr := string(it.Item().Key())
			seqIndex := strings.LastIndex(keyStr, "/")
			if seqIndex == -1 {
				return fmt.Errorf("invalid vaa key: %s", keyStr)
			}
			sequence, err := strconv.ParseUint(keyStr[seqIndex+1:], 10, 64)
			if err != nil {
				return err
			}
			if !contains(sequence) {
				continue
			}
			targetChainIndex := strings.LastIndex(keyStr[:seqIndex], "/")
			if targetChainIndex == -1 {
				return fmt.Errorf("invalid vaa key: %s", keyStr)
			}
			targetChain, err := strconv.ParseUint(keyStr[targetChainIndex+1:seqIndex], 10, 16)
			if err != nil {
				return err
			}
			vaaBytes, err := it.Item().ValueCopy(nil)
			if err != nil {
				return err
			}
			vaas = append(vaas, &GovernanceVAA{
				TargetChain: vaa.ChainID(targetChain),
				Sequence:    sequence,
				VaaBytes:    vaaBytes,
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return vaas, nil
}

func (d *Database) NextGovernanceVAASequence(governanceChainId vaa.ChainID, governanceEmitter vaa.Address) (*uint64, error) {
	hasGovernanceVAA := false
	maxSequence := uint64(0)
	vaaId := &vaa.VAAID{
		EmitterChain:   governanceChainId,
		EmitterAddress: governanceEmitter,
	}
	prefixBytes := vaaId.GovernanceEmitterPrefixBytes()
	if err := d.db.View(func(txn *badger.Txn) error {
		iteratorOpts := badger.DefaultIteratorOptions
		iteratorOpts.PrefetchValues = false
		iteratorOpts.Prefix = prefixBytes
		it := txn.NewIterator(iteratorOpts)
		defer it.Close()

		for it.Seek(prefixBytes); it.ValidForPrefix(prefixBytes); it.Next() {
			hasGovernanceVAA = true
			keyStr := string(it.Item().Key())
			index := strings.LastIndex(keyStr, "/")
			if index == -1 {
				return fmt.Errorf("invalid vaa key: %s", keyStr)
			}
			sequence, err := strconv.ParseUint(keyStr[index+1:], 10, 64)
			if err != nil {
				return err
			}
			if sequence > maxSequence {
				maxSequence = sequence
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if !hasGovernanceVAA {
		nextSequence := uint64(0)
		return &nextSequence, nil
	}
	nextSequence := maxSequence + 1
	return &nextSequence, nil
}

func (d *Database) GetSignedVAABytes(id vaa.VAAID) (b []byte, err error) {
	if err := d.db.View(func(txn *badger.Txn) error {
		item, err := txn.Get(id.Bytes())
		if err != nil {
			return err
		}
		if val, err := item.ValueCopy(nil); err != nil {
			return err
		} else {
			b = val
		}
		return nil
	}); err != nil {
		if err == badger.ErrKeyNotFound {
			return nil, ErrVAANotFound
		}
		return nil, err
	}
	return
}

func (d *Database) FindEmitterSequenceGap(prefix vaa.VAAID) (resp []uint64, firstSeq uint64, lastSeq uint64, err error) {
	resp = make([]uint64, 0)
	if err = d.db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(badger.DefaultIteratorOptions)
		defer it.Close()
		prefix := prefix.EmitterPrefixBytes()

		// Find all sequence numbers (the message IDs are ordered lexicographically,
		// rather than numerically, so we need to sort them in-memory).
		seqs := make(map[uint64]bool)
		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
			item := it.Item()
			key := item.Key()
			err := item.Value(func(val []byte) error {
				v, err := vaa.Unmarshal(val)
				if err != nil {
					return fmt.Errorf("failed to unmarshal VAA for %s: %v", string(key), err)
				}

				seqs[v.Sequence] = true
				return nil
			})
			if err != nil {
				return err
			}
		}

		// Find min/max (yay lack of Go generics)
		first := false
		for k := range seqs {
			if first {
				firstSeq = k
				first = false
			}
			if k < firstSeq {
				firstSeq = k
			}
			if k > lastSeq {
				lastSeq = k
			}
		}

		// Figure out gaps.
		for i := firstSeq; i <= lastSeq; i++ {
			if !seqs[i] {
				fmt.Printf("missing: %d\n", i)
				resp = append(resp, i)
			}
		}

		return nil
	}); err != nil {
		return
	}
	return
}
