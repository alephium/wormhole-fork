module github.com/certusone/wormhole/event_database/cloud_functions

go 1.16

// cloud runtime is go 1.16. just for reference.

require (
	cloud.google.com/go/bigtable v1.12.0
	cloud.google.com/go/pubsub v1.17.1
	cloud.google.com/go/storage v1.18.2
	github.com/GoogleCloudPlatform/functions-framework-go v1.5.2
	github.com/certusone/wormhole/node v0.0.0-20220413222417-6e58ae511d52
	github.com/cosmos/cosmos-sdk v0.44.5
	github.com/ethereum/go-ethereum v1.10.6
	github.com/gagliardetto/solana-go v1.0.2
	github.com/holiman/uint256 v1.2.0
)

replace github.com/gogo/protobuf => github.com/regen-network/protobuf v1.3.3-alpha.regen.1
