#!/usr/bin/env bash
# This script allows devnet initalization with more than one guardian.
set -exuo pipefail

echo "number of guardians to initialize: $NUM_OF_GUARDIANS"

# assert jq exists before trying to use it
if ! type -p jq; then
    echo "ERROR: jq is not installed"! >&2
    exit 1
fi

alephiumConfigJson="./configs/alephium/devnet.json"
ethereumConfigJson="./configs/ethereum/devnet.json"
bscConfigJson="./configs/bsc/devnet.json"
guardianConfigJson="./configs/guardian/devnet.json"

ethTokenBridge=$(jq --raw-output '.tokenBridgeEmitterAddress' $ethereumConfigJson)
ethNativeTokenBridge=$(jq --raw-output '.contracts.tokenBridge' $ethereumConfigJson)
bscTokenBridge=$(jq --raw-output '.tokenBridgeEmitterAddress' $bscConfigJson)
bscNativeTokenBridge=$(jq --raw-output '.contracts.tokenBridge' $bscConfigJson)
alphTokenBridge=$(jq --raw-output '.tokenBridgeEmitterAddress' $alephiumConfigJson)
alphNativeTokenBridge=$(jq --raw-output '.contracts.nativeTokenBridge' $alephiumConfigJson)

alphNodeUrl="http://alephium:22973"
ethNodeUrl="http://eth-devnet:8545"
bscNodeUrl="http://bsc-devnet:8545"

# wait contract deployments
wait() {
  SECONDS=0
  until $(eval $1); do
    if (( SECONDS > 300 ))
    then
       echo "Contracts are not deployed after 5 min..."
       exit 1
    fi
    echo "Waiting..."
    sleep 5
  done
}

evmContractExists() {
  address=$1
  nodeUrl=$2
  code=$(curl --silent -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$address\"],\"id\":1}" $nodeUrl | jq --raw-output '."result"')
  size=${#code}
  if [ $size -gt 2 ]; then
    return 0
  else
    return 1
  fi
}

wait "curl --output /dev/null --silent --fail $alphNodeUrl/addresses/$alphNativeTokenBridge/group"
wait "evmContractExists $ethNativeTokenBridge $ethNodeUrl"
wait "evmContractExists $bscNativeTokenBridge $bscNodeUrl"

echo "generating guardian set addresses"
# create an array of strings containing the ECDSA public keys of the devnet guardians in the guardianset:
# guardiansPublicEth has the leading "0x" that Eth scripts expect.
guardiansPublicEth=$(jq -c --argjson lastIndex 1 '.guardians[:$lastIndex] | [.[].public]' $guardianConfigJson)
# guardiansPublicHex does not have a leading "0x", just hex strings.
guardiansPublicHex=$(jq -c --argjson lastIndex 1 '.guardians[:$lastIndex] | [.[].public[2:]]' $guardianConfigJson)
# also make a CSV string of the hex addresses, so the client scripts that need that format don't have to.
guardiansPublicHexCSV=$(echo ${guardiansPublicHex} | jq --raw-output -c  '. | join(",")')

# 2) guardian private keys - used for generating the initial governance VAAs (register token bridge & nft bridge contracts on each chain).
echo "generating guardian set keys"
# create an array of strings containing the private keys of the devnet guardians in the guardianset
guardiansPrivate=$(jq -c --argjson lastIndex 1 '.guardians[:$lastIndex] | [.[].private]' $guardianConfigJson)
# create a CSV string with the private keys of the guardians in the guardianset, that will be used to create registration VAAs
guardiansPrivateCSV=$( echo ${guardiansPrivate} | jq --raw-output -c  '. | join(",")')

registerEthTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c ethereum -a ${ethTokenBridge} -g ${guardiansPrivateCSV} -s 0)
registerAlphTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c alephium -a ${alphTokenBridge} -g ${guardiansPrivateCSV} -s 1)
registerBscTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c bsc -a ${bscTokenBridge} -g ${guardiansPrivateCSV} -s 2)
npm --prefix clients/js start --silent -- submit ${registerEthTokenBridgeVAA} -c alephium -n devnet --node-url $alphNodeUrl
npm --prefix clients/js start --silent -- submit ${registerBscTokenBridgeVAA} -c alephium -n devnet --node-url $alphNodeUrl
npm --prefix clients/js start --silent -- submit ${registerAlphTokenBridgeVAA} -c ethereum -n devnet --node-url $ethNodeUrl
npm --prefix clients/js start --silent -- submit ${registerBscTokenBridgeVAA} -c ethereum -n devnet --node-url $ethNodeUrl
npm --prefix clients/js start --silent -- submit ${registerAlphTokenBridgeVAA} -c bsc -n devnet --node-url $bscNodeUrl
npm --prefix clients/js start --silent -- submit ${registerEthTokenBridgeVAA} -c bsc -n devnet --node-url $bscNodeUrl

# create guardian set upgrade vaa if the NUM_OF_GUARDIANS > 1
if [[ "$NUM_OF_GUARDIANS" -gt "1" ]]; then
    echo "creating guardian set upgrade vaa"
    newGuardiansPublicHex=$(jq -c --argjson lastIndex $NUM_OF_GUARDIANS '.guardians[:$lastIndex] | [.[].public[2:]]' $guardianConfigJson)
    newGuardiansPublicHexCSV=$(echo ${newGuardiansPublicHex} | jq --raw-output -c  '. | join(",")')
    guardianSetUpgradeVAA=$(npm --prefix clients/js start --silent -- generate guardian-set-upgrade -i 1 -k ${newGuardiansPublicHexCSV} -g ${guardiansPrivateCSV} -s 0)
    npm --prefix clients/js start --silent -- submit ${guardianSetUpgradeVAA} -c alephium -n devnet --node-url $alphNodeUrl
    npm --prefix clients/js start --silent -- submit ${guardianSetUpgradeVAA} -c ethereum -n devnet --node-url $ethNodeUrl
    npm --prefix clients/js start --silent -- submit ${guardianSetUpgradeVAA} -c bsc -n devnet --node-url $bscNodeUrl
fi
