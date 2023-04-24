package guardiand

import (
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"

	"github.com/davecgh/go-spew/spew"
	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/prototext"

	nodev1 "github.com/alephium/wormhole-fork/node/pkg/proto/node/v1"
)

var AdminClientGovernanceVAAVerifyCmd = &cobra.Command{
	Use:   "governance-vaa-verify [NETWORK] [FILENAME]",
	Short: "Verify governance vaa in prototxt format (offline)",
	Run:   runGovernanceVAAVerify,
	Args:  cobra.ExactArgs(2),
}

func runGovernanceVAAVerify(cmd *cobra.Command, args []string) {
	network := args[0]
	guardianConfig, err := common.ReadGuardianConfig(network)
	if err != nil {
		log.Fatalf("failed to read configs, err: %v", err)
	}

	governanceChainId := vaa.ChainID(guardianConfig.GovernanceChainId)
	governanceEmitterAddress, err := vaa.StringToAddress(guardianConfig.GovernanceEmitterAddress)
	if err != nil {
		log.Fatalf("invalid governance emitter address %s, error: %v", guardianConfig.GovernanceEmitterAddress, err)
	}

	path := args[1]

	b, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatalf("failed to read file: %v", err)
	}

	var req nodev1.InjectGovernanceVAARequest
	err = prototext.Unmarshal(b, &req)
	if err != nil {
		log.Fatalf("failed to deserialize: %v", err)
	}

	timestamp := time.Unix(int64(req.Timestamp), 0)

	for _, message := range req.Messages {
		var (
			v *vaa.VAA
		)
		if message.TargetChainId > math.MaxUint16 {
			panic(fmt.Sprintf("invalid target chain id: %d", message.TargetChainId))
		}
		targetChainId := vaa.ChainID(message.TargetChainId)
		switch payload := message.Payload.(type) {
		case *nodev1.GovernanceMessage_UpdateMessageFee:
			v, err = adminUpdateMessageFeeToVAA(governanceChainId, governanceEmitterAddress, payload.UpdateMessageFee, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_TransferFee:
			v, err = adminTransferFeeToVAA(governanceChainId, governanceEmitterAddress, payload.TransferFee, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_GuardianSet:
			v, err = adminGuardianSetUpgradeToVAA(governanceChainId, governanceEmitterAddress, payload.GuardianSet, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_ContractUpgrade:
			v, err = adminContractUpgradeToVAA(governanceChainId, governanceEmitterAddress, payload.ContractUpgrade, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_BridgeRegisterChain:
			v, err = tokenBridgeRegisterChain(governanceChainId, governanceEmitterAddress, payload.BridgeRegisterChain, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_BridgeContractUpgrade:
			v, err = tokenBridgeUpgradeContract(governanceChainId, governanceEmitterAddress, payload.BridgeContractUpgrade, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_DestroyUnexecutedSequenceContracts:
			v, err = tokenBridgeDestroyUnexecutedSequenceContracts(governanceChainId, governanceEmitterAddress, payload.DestroyUnexecutedSequenceContracts, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_UpdateMinimalConsistencyLevel:
			v, err = tokenBridgeUpdateMinimalConsistencyLevel(governanceChainId, governanceEmitterAddress, payload.UpdateMinimalConsistencyLevel, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_UpdateRefundAddress:
			v, err = tokenBridgeUpdateRefundAddress(governanceChainId, governanceEmitterAddress, payload.UpdateRefundAddress, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		default:
			panic(fmt.Sprintf("unsupported VAA type: %T", payload))
		}
		if err != nil {
			log.Fatalf("invalid update: %v", err)
		}

		digest := v.SigningMsg()
		if err != nil {
			panic(err)
		}

		b, err := v.Marshal()
		if err != nil {
			panic(err)
		}

		log.Printf("Serialized: %v", hex.EncodeToString(b))

		log.Printf("VAA with digest %s: %+v", digest.Hex(), spew.Sdump(v))
	}
}
