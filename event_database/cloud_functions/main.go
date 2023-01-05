package p

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"

	"cloud.google.com/go/pubsub"
	"github.com/GoogleCloudPlatform/functions-framework-go/funcframework"
	"github.com/alephium/wormhole-fork/node/pkg/common"
)

func loadEmitters() (*Emitters, error) {
	// TODO: add mainnet after we deployed contracts on mainnet
	networks := []string{"devnet", "testnet"}
	nftEmitters := make(map[string]string)
	tokenTransferEmitters := make(map[string]string)
	for _, network := range networks {
		configs, err := common.ReadConfigsByNetwork(network)
		if err != nil {
			return nil, err
		}
		tokenTransferEmitters[strings.ToLower(configs.Alephium.TokenBridgeEmitterAddress)] = strings.ToLower(configs.Alephium.Contracts.TokenBridge)
		tokenTransferEmitters[strings.ToLower(configs.Ethereum.TokenBridgeEmitterAddress)] = strings.ToLower(configs.Ethereum.Contracts.TokenBridge)
	}
	emitters := &Emitters{
		TokenTransferEmitters: tokenTransferEmitters,
		NFTEmitters:           nftEmitters,
	}
	return emitters, nil
}

func createAndSubscribe(client *pubsub.Client, topicName, subscriptionName string, handler func(ctx context.Context, m PubSubMessage) error) {
	var topic *pubsub.Topic
	var topicErr error
	ctx := context.Background()
	topic, topicErr = client.CreateTopic(ctx, topicName)
	if topicErr != nil {
		log.Printf("pubsub.CreateTopic err: %v", topicErr)
		// already exists
		topic = client.Topic(topicName)
	} else {
		log.Println("created topic:", topicName)
	}

	subConf := pubsub.SubscriptionConfig{Topic: topic}
	_, subErr := client.CreateSubscription(ctx, subscriptionName, subConf)
	if subErr != nil {
		log.Printf("pubsub.CreateSubscription err: %v", subErr)
	} else {
		log.Println("created subscription:", subscriptionName)
	}

	sub := client.Subscription(subscriptionName)

	err := sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		msg.Ack()
		handler(ctx, PubSubMessage{Data: msg.Data})

	})
	if err != nil {
		fmt.Println(fmt.Errorf("receive err: %v", err))
	}
}

var mux = newMux()

// Entry is the cloud function entry point
func Entry(w http.ResponseWriter, r *http.Request) {
	mux.ServeHTTP(w, r)
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/notionaltransferred", NotionalTransferred)
	mux.HandleFunc("/notionaltransferredto", NotionalTransferredTo)
	mux.HandleFunc("/notionaltransferredfrom", NotionalTransferredFrom)
	mux.HandleFunc("/computenotionaltransferredfrom", ComputeNotionalTransferredFrom)
	mux.HandleFunc("/notionaltransferredtocumulative", NotionalTransferredToCumulative)
	mux.HandleFunc("/notionaltvl", TVL)
	mux.HandleFunc("/computenotionaltvl", ComputeTVL)
	mux.HandleFunc("/notionaltvlcumulative", TvlCumulative)
	mux.HandleFunc("/computenotionaltvlcumulative", ComputeTvlCumulative)
	mux.HandleFunc("/addressestransferredto", AddressesTransferredTo)
	mux.HandleFunc("/addressestransferredtocumulative", AddressesTransferredToCumulative)
	mux.HandleFunc("/totals", Totals)
	mux.HandleFunc("/nfts", NFTs)
	mux.HandleFunc("/recent", Recent)
	mux.HandleFunc("/transaction", Transaction)
	mux.HandleFunc("/readrow", ReadRow)
	mux.HandleFunc("/findvalues", FindValues)

	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	return mux
}

func main() {
	emitters, err := loadEmitters()
	if err != nil {
		log.Fatalf("failed to load emitters, err: %v", err)
	}

	var wg sync.WaitGroup

	// http functions
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := context.Background()
		if err := funcframework.RegisterHTTPFunctionContext(ctx, "/", Entry); err != nil {
			log.Fatalf("funcframework.RegisterHTTPFunctionContext: %v\n", err)
		}
		// Use PORT environment variable, or default to 8080.
		port := "8080"
		if envPort := os.Getenv("PORT"); envPort != "" {
			port = envPort
		}
		if err := funcframework.Start(port); err != nil {
			log.Fatalf("funcframework.Start: %v\n", err)
		}
	}()

	// pubsub functions
	pubsubCtx := context.Background()
	gcpProject := os.Getenv("GCP_PROJECT")

	pubsubClient, err := pubsub.NewClient(pubsubCtx, gcpProject)
	if err != nil {
		fmt.Println(fmt.Errorf("pubsub.NewClient err: %v", err))
	}

	pubsubTopicVAA := os.Getenv("PUBSUB_NEW_VAA_TOPIC")
	pubsubSubscriptionVAA := os.Getenv("PUBSUB_NEW_VAA_SUBSCRIPTION")

	processVAA := func(ctx context.Context, m PubSubMessage) error {
		return ProcessVAA(ctx, m, emitters)
	}

	wg.Add(1)
	go createAndSubscribe(pubsubClient, pubsubTopicVAA, pubsubSubscriptionVAA, processVAA)
	wg.Done()

	pubsubTopicTransfer := os.Getenv("PUBSUB_TOKEN_TRANSFER_DETAILS_TOPIC")
	pubsubSubscriptionTransfer := os.Getenv("PUBSUB_TOKEN_TRANSFER_DETAILS_SUBSCRIPTION")
	wg.Add(1)
	go createAndSubscribe(pubsubClient, pubsubTopicTransfer, pubsubSubscriptionTransfer, ProcessTransfer)
	wg.Done()

	wg.Wait()
	pubsubClient.Close()
}
