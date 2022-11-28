package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/cookiejar"
	"strconv"
	"strings"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/db"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum/abi"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	nodev1 "github.com/alephium/wormhole-fork/node/pkg/proto/node/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	abi2 "github.com/ethereum/go-ethereum/accounts/abi"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"golang.org/x/time/rate"
	"google.golang.org/grpc"
)

const EtherscanAPI = "https://api.etherscan.io/api"

var (
	network      = flag.String("network", "", "Network type (devnet, testnet, mainnet)")
	adminRPC     = flag.String("adminRPC", "/run/guardiand/admin.socket", "Admin RPC address")
	etherscanKey = flag.String("etherscanKey", "", "Etherscan API Key")
	targetChain  = flag.Uint("targetChain", 0, "VAA target chain id")
	dryRun       = flag.Bool("dryRun", true, "Dry run")
	step         = flag.Uint64("step", 10000, "Step")
	showError    = flag.Bool("showError", false, "On http error, show the response body")
	sleepTime    = flag.Int("sleepTime", 0, "Time to sleep between loops when getting logs")
)

var (
	tokenLockupTopic = eth_common.HexToHash("0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2")
)

// Add a browser User-Agent to make cloudflare more happy
func addUserAgent(req *http.Request) *http.Request {
	if req == nil {
		return nil
	}
	req.Header.Set(
		"User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
	)
	return req
}

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, error, nodev1.NodePrivilegedServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, err, c
}

type logEntry struct {
	// 0x98f3c9e6e3face36baad05fe09d375ef1464288b
	Address string `json:"address"`
	// [
	//  "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2",
	//  "0x0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585"
	// ]
	Topics []string `json:"topics"`
	// Hex-encoded log data
	Data string `json:"data"`
	// 0xcaebbf
	BlockNumber string `json:"blockNumber"`
	// 0x614fd32b
	TimeStamp string `json:"timeStamp"`
	// 0x960778c48
	GasPrice string `json:"gasPrice"`
	// 0x139d5
	GasUsed string `json:"gasUsed"`
	// 0x18d
	LogIndex string `json:"logIndex"`
	// 0xcc5d73aea74ffe6c8e5e9c212da7eb3ea334f41ac3fd600a9979de727535c849
	TransactionHash string `json:"transactionHash"`
	// 0x117
	TransactionIndex string `json:"transactionIndex"`
}

type logResponse struct {
	// "1" if ok, "0" if error
	Status string `json:"status"`
	// "OK" if ok, "NOTOK" otherwise
	Message string `json:"message"`
	// String when status is "0", result type otherwise.
	Result json.RawMessage `json:"result"`
}

func getCurrentHeight(ctx context.Context, c *http.Client, api, key string, showErr bool) (uint64, error) {
	var req *http.Request
	var err error
	req, err = http.NewRequest("GET", fmt.Sprintf("%s?module=proxy&action=eth_blockNumber&apikey=%s", api, key), nil)
	if err != nil {
		panic(err)
	}
	req = addUserAgent(req)

	resp, err := c.Do(req.WithContext(ctx))
	if err != nil {
		return 0, fmt.Errorf("failed to get current height: %w", err)
	}

	defer resp.Body.Close()

	var r struct {
		Result string `json:"result"`
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK && showErr {
		fmt.Println(string(body))
	}

	if err := json.Unmarshal(body, &r); err != nil {
		return 0, fmt.Errorf("failed to decode response: %w", err)
	}

	return hexutil.DecodeUint64(r.Result)
}

func getLogs(ctx context.Context, c *http.Client, api, key, contract, topic0 string, from, to string, showErr bool) ([]*logEntry, error) {
	var req *http.Request
	var err error
	req, err = http.NewRequestWithContext(ctx, "GET", fmt.Sprintf(
		"%s?module=logs&action=getLogs&fromBlock=%s&toBlock=%s&address=%s&topic0=%s&apikey=%s",
		api, from, to, contract, topic0, key), nil)
	if err != nil {
		panic(err)
	}
	req = addUserAgent(req)

	resp, err := c.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get logs: %w", err)
	}

	defer resp.Body.Close()

	var r logResponse

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK && showErr {
		fmt.Println(string(body))
	}

	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if r.Status != "1" && r.Message != "No records found" {
		var e string
		_ = json.Unmarshal(r.Result, &e)
		return nil, fmt.Errorf("failed to get logs (%s): %s", r.Message, e)
	}

	var logs []*logEntry
	if err := json.Unmarshal(r.Result, &logs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal log entry: %w", err)
	}

	return logs, nil
}

func main() {
	flag.Parse()

	bridgeConfig, err := common.ReadConfigsByNetwork(*network)
	if err != nil {
		log.Fatalf("failed to read configs, network: %s", *network)
	}

	if *targetChain > math.MaxUint16 {
		log.Fatalf("invalid target chain id: %d", *targetChain)
	}

	if *etherscanKey == "" {
		// BlockScout based explorers don't require an ether scan key
		log.Fatal("Etherscan API Key is required")
	}

	coreContract := bridgeConfig.Ethereum.Contracts.Governance
	ctx := context.Background()

	jar, err := cookiejar.New(nil)
	if err != nil {
		log.Fatalf("Error creating http cookiejar: %v", err)
	}
	httpClient := &http.Client{
		Jar: jar,
	}
	currentHeight, err := getCurrentHeight(ctx, httpClient, EtherscanAPI, *etherscanKey, *showError)
	if err != nil {
		log.Fatalf("Failed to get current height: %v", err)
	}

	log.Printf("Current height: %d", currentHeight)

	missingMessages := make(map[eth_common.Address]map[uint64]bool)

	conn, err, admin := getAdminClient(ctx, *adminRPC)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	contract := eth_common.HexToAddress(bridgeConfig.Ethereum.Contracts.TokenBridge)
	emitterAddress := bridgeConfig.Ethereum.TokenBridgeEmitterAddress

	log.Printf("Requesting missing messages for %s (%v)", emitterAddress, contract)

	guardianPublicEndpoints := bridgeConfig.Guardian.GuardianUrls
	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(vaa.ChainIDEthereum),
		TargetChain:    uint32(*targetChain),
		EmitterAddress: emitterAddress,
		RpcBackfill:    true,
		BackfillNodes:  guardianPublicEndpoints,
	}
	resp, err := admin.FindMissingMessages(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
	}

	msgs := []*db.VAAID{}
	for _, id := range resp.MissingMessages {
		fmt.Println(id)
		vId, err := db.VaaIDFromString(id)
		if err != nil {
			log.Fatalf("failed to parse VAAID: %v", err)
		}
		msgs = append(msgs, vId)
	}

	if len(msgs) == 0 {
		log.Printf("No missing messages found for %s", emitterAddress)
		return
	}

	lowest := msgs[0].Sequence
	highest := msgs[len(msgs)-1].Sequence

	log.Printf("Found %d missing messages for %s: %d – %d", len(msgs), emitterAddress, lowest, highest)

	if _, ok := missingMessages[contract]; !ok {
		missingMessages[contract] = make(map[uint64]bool)
	}
	for _, msg := range msgs {
		missingMessages[contract][msg.Sequence] = true
	}

	// Press enter to continue if not in dryRun mode
	if !*dryRun {
		fmt.Println("Press enter to continue")
		fmt.Scanln()
	}

	log.Printf("finding sequences")

	limiter := rate.NewLimiter(rate.Every(1*time.Second), 1)

	c := &http.Client{
		Jar:     jar,
		Timeout: 5 * time.Second,
	}

	ethAbi, err := abi2.JSON(strings.NewReader(abi.AbiABI))
	if err != nil {
		log.Fatalf("failed to parse Eth ABI: %v", err)
	}

	var lastHeight uint64
	step := *step
	for {
		if err := limiter.Wait(ctx); err != nil {
			log.Fatalf("failed to wait: %v", err)
		}

		var from, to string
		if lastHeight == 0 {
			from = strconv.Itoa(int(currentHeight - step))
			to = "latest"
			lastHeight = currentHeight
		} else {
			from = strconv.Itoa(int(lastHeight - step))
			to = strconv.Itoa(int(lastHeight))
		}
		lastHeight -= step

		log.Printf("Requesting logs from block %s to %s", from, to)

		logs, err := getLogs(ctx, c, EtherscanAPI, *etherscanKey, coreContract, tokenLockupTopic.Hex(), from, to, *showError)
		if err != nil {
			log.Fatalf("failed to get logs: %v", err)
		}

		if len(logs) == 0 {
			log.Printf("No logs found")
			continue
		}

		firstBlock, err := hexutil.DecodeUint64(logs[0].BlockNumber)
		if err != nil {
			log.Fatalf("failed to decode block number: %v", err)
		}
		lastBlock, err := hexutil.DecodeUint64(logs[len(logs)-1].BlockNumber)
		if err != nil {
			log.Fatalf("failed to decode block number: %v", err)
		}

		log.Printf("Got %d logs (first block: %d, last block: %d)",
			len(logs), firstBlock, lastBlock)

		if len(logs) >= 1000 {
			// Bail if we exceeded the maximum number of logs returns in single API call -
			// we might have skipped some and would have to make another call to get the rest.
			//
			// This is a one-off script, so we just set an appropriate interval and bail
			// if we ever hit this.
			log.Fatalf("Range exhausted - %d logs found", len(logs))
		}

		var min, max uint64
		for _, l := range logs {
			if eth_common.HexToHash(l.Topics[0]) != tokenLockupTopic {
				continue
			}

			b, err := hexutil.Decode(l.Data)
			if err != nil {
				log.Fatalf("failed to decode log data for %s: %v", l.TransactionHash, err)
			}

			var seq uint64
			if m, err := ethAbi.Unpack("LogMessagePublished", b); err != nil {
				log.Fatalf("failed to unpack log data for %s: %v", l.TransactionHash, err)
			} else {
				seq = m[0].(uint64)
			}

			if seq < min || min == 0 {
				min = seq
			}
			if seq > max {
				max = seq
			}

			emitter := eth_common.HexToAddress(l.Topics[1])
			tx := eth_common.HexToHash(l.TransactionHash)

			if _, ok := missingMessages[emitter]; !ok {
				continue
			}
			if !missingMessages[emitter][seq] {
				continue
			}

			log.Printf("Found missing message %d for %s in tx %s", seq, emitter, tx.Hex())
			delete(missingMessages[emitter], seq)

			if *dryRun {
				continue
			}

			log.Printf("Requesting re-observation for %s", tx.Hex())

			_, err = admin.SendObservationRequest(ctx, &nodev1.SendObservationRequestRequest{
				ObservationRequest: &gossipv1.ObservationRequest{
					ChainId: uint32(vaa.ChainIDEthereum),
					TxHash:  tx.Bytes(),
				}})
			if err != nil {
				log.Fatalf("SendObservationRequest: %v", err)
			}

			emitterAddressHex := hex.EncodeToString(eth_common.LeftPadBytes(emitter.Bytes(), 32))
			for i := 0; i < 10; i++ {
				log.Printf("verifying %d", seq)
				reqUrl := fmt.Sprintf(
					"%s/v1/signed_vaa/%d/%s/%d/%d",
					guardianPublicEndpoints[0],
					vaa.ChainIDEthereum,
					emitterAddressHex,
					targetChain,
					seq,
				)
				req, err := http.NewRequestWithContext(ctx, "GET", reqUrl, nil)
				if err != nil {
					panic(err)
				}
				req = addUserAgent(req)
				resp, err := c.Do(req)
				if err != nil {
					log.Fatalf("verify: %v", err)
				}

				if resp.StatusCode != http.StatusOK {
					log.Printf("status %d, retrying", resp.StatusCode)
					time.Sleep(5 * time.Second)
					continue
				} else {
					log.Printf("success %d", seq)
					break
				}
			}
		}

		log.Printf("Seq: %d - %d", min, max)

		var total int
		for em, entries := range missingMessages {
			total += len(entries)
			log.Printf("%d missing messages for %s left", len(entries), em.Hex())
		}
		if total == 0 {
			log.Printf("No missing messages left")
			break
		}
		// Allow sleeping between loops for chains that have aggressive blocking in the explorers
		if sleepTime != nil {
			time.Sleep(time.Duration(*sleepTime) * time.Second)
		}
	}
}
