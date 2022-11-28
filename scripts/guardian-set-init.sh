#!/usr/bin/env bash
# This script allows devnet initalization with more than one guardian.
# First argument is the number of guardians for the initial guardian set.
set -exuo pipefail

numGuardians=$1
echo "number of guardians to initialize: ${numGuardians}"

addressesJson="./scripts/devnet-consts.json"

# working files for accumulating state
ethFile="./scripts/.env.0x" # for "0x" prefixed data, for ethereum scripts
alphFile="./scripts/.env.alph"

# copy the eth defaults so we can override just the things we need
cp ./ethereum/.env.test $ethFile
cp ./alephium/.env.test $alphFile


# function for updating or inserting a KEY=value pair in a file.
function upsert_env_file {
    file=${1} # file will be created if it does not exist.
    key=${2}  # line must start with the key.
    new_value=${3}

    # replace the value if it exists, else, append it to the file
    if [[ -f $file ]] && grep -q "^$key=" $file; then
        # file has the key, update it:
        sed -i "/^$key=/s/=.*/=$new_value/" $file
    else
        # file does not have the key, add it:
        echo "$key=$new_value" >> $file
    fi
}

# assert jq exists before trying to use it
if ! type -p jq; then
    echo "ERROR: jq is not installed"! >&2
    exit 1
fi


# 1) guardian public keys - used as the inital guardian set when initializing contracts.
echo "generating guardian set addresses"
# create an array of strings containing the ECDSA public keys of the devnet guardians in the guardianset:
# guardiansPublicEth has the leading "0x" that Eth scripts expect.
guardiansPublicEth=$(jq -c --argjson lastIndex 1 '.devnetGuardians[:$lastIndex] | [.[].public]' $addressesJson)
# guardiansPublicHex does not have a leading "0x", just hex strings.
guardiansPublicHex=$(jq -c --argjson lastIndex 1 '.devnetGuardians[:$lastIndex] | [.[].public[2:]]' $addressesJson)
# also make a CSV string of the hex addresses, so the client scripts that need that format don't have to.
guardiansPublicHexCSV=$(echo ${guardiansPublicHex} | jq --raw-output -c  '. | join(",")')

# write the lists of addresses to the env files
initSigners="INIT_SIGNERS"
upsert_env_file $ethFile $initSigners $guardiansPublicEth
upsert_env_file $alphFile $initSigners $guardiansPublicHex


# 2) guardian private keys - used for generating the initial governance VAAs (register token bridge & nft bridge contracts on each chain).
echo "generating guardian set keys"
# create an array of strings containing the private keys of the devnet guardians in the guardianset
guardiansPrivate=$(jq -c --argjson lastIndex 1 '.devnetGuardians[:$lastIndex] | [.[].private]' $addressesJson)
# create a CSV string with the private keys of the guardians in the guardianset, that will be used to create registration VAAs
guardiansPrivateCSV=$( echo ${guardiansPrivate} | jq --raw-output -c  '. | join(",")')

guardiansKeyName=$(jq -c --argjson lastIndex 1 '.devnetGuardians[:$lastIndex] | [.[].keyName]' $addressesJson)
guardiansKeyNameCSV=$( echo ${guardiansKeyName} | jq --raw-output -c  '. | join(",")')

# write the lists of keys to the env files
upsert_env_file $ethFile "INIT_SIGNERS_KEYS_JSON" $guardiansPrivate

# create guardian set upgrade vaa if the numGuardians > 1
if [[ "${numGuardians}" -gt "1" ]]; then
    echo "creating guardian set upgrade vaa"
    newGuardiansPublicHex=$(jq -c --argjson lastIndex $numGuardians '.devnetGuardians[:$lastIndex] | [.[].public[2:]]' $addressesJson)
    newGuardiansPublicHexCSV=$(echo ${newGuardiansPublicHex} | jq --raw-output -c  '. | join(",")')
    guardianSetUpgradeVAA=$(npm --prefix clients/js start --silent -- generate guardian-set-upgrade -i 1 -k ${newGuardiansPublicHexCSV} -g ${guardiansPrivateCSV} -s 0)
    guardianSetUpgrade="GUARDIAN_SET_UPGRADE_VAA"
    upsert_env_file $ethFile $guardianSetUpgrade $guardianSetUpgradeVAA
    upsert_env_file $alphFile $guardianSetUpgrade $guardianSetUpgradeVAA
fi

# 3) fetch and store the contract addresses that we need to make contract registration governance VAAs for:
echo "getting contract addresses for chain registrations from $addressesJson"
# get addresses from the constants file
ethTokenBridge=$(jq --raw-output '.chains."2".contracts.tokenBridgeEmitterAddress' $addressesJson)
bscTokenBridge=$(jq --raw-output '.chains."4".contracts.tokenBridgeEmitterAddress' $addressesJson)
alphTokenBridge=$(jq --raw-output '.chains."255".contracts.tokenBridgeEmitterAddress' $addressesJson)

ethNFTBridge=$(jq --raw-output '.chains."2".contracts.nftBridgeEmitterAddress' $addressesJson)

# 4) create token bridge registration VAAs
echo "generating contract registration VAAs for token bridges"
# fetch dependencies for the clients/token_bridge script that generates token bridge registration VAAs
if [[ ! -d ./clients/js/node_modules ]]; then
    echo "going to install node modules in clients/js"
    npm ci --prefix clients/js
fi
# invoke clients/token_bridge commands to create registration VAAs
ethTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c ethereum -a ${ethTokenBridge} -g ${guardiansPrivateCSV} -s 0)
bscTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c bsc -a ${bscTokenBridge} -g ${guardiansPrivateCSV} -s 1)
alphTokenBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m TokenBridge -c alephium -a ${alphTokenBridge} -g ${guardiansPrivateCSV} -s 2)

# 5) create nft bridge registration VAAs
echo "generating contract registration VAAs for nft bridges"
ethNFTBridgeVAA=$(npm --prefix clients/js start --silent -- generate registration -m NFTBridge -c ethereum -a ${ethNFTBridge} -g ${guardiansPrivateCSV})

# 6) write the registration VAAs to env files
echo "writing VAAs to .env files"
# define the keys that will hold the chain registration governance VAAs
ethTokenBridge="REGISTER_ETH_TOKEN_BRIDGE_VAA"
bscTokenBridge="REGISTER_BSC_TOKEN_BRIDGE_VAA"
alphTokenBridge="REGISTER_ALPH_TOKEN_BRIDGE_VAA"

ethNFTBridge="REGISTER_ETH_NFT_BRIDGE_VAA"

# bsc token bridge
upsert_env_file $ethFile $bscTokenBridge $bscTokenBridgeVAA

# ethereum token bridge
upsert_env_file $ethFile $ethTokenBridge $ethTokenBridgeVAA

# ethereum nft bridge
upsert_env_file $ethFile $ethNFTBridge $ethNFTBridgeVAA

# alph token bridge
upsert_env_file $ethFile $alphTokenBridge $alphTokenBridgeVAA

upsert_env_file $alphFile $ethTokenBridge $ethTokenBridgeVAA
upsert_env_file $alphFile $bscTokenBridge $bscTokenBridgeVAA

# 7) copy the local .env file to the solana & terra dirs, if the script is running on the host machine
# chain dirs will not exist if running in docker for Tilt, only if running locally. check before copying.
# copy ethFile to ethereum
if [[ -d ./ethereum ]]; then
    echo "copying $ethFile to /etherum/.env"
    cp $ethFile ./ethereum/.env
fi

# copy the alphFile to alephium dir
if [[ -d ./alephium ]]; then
    echo "copying $alphFile to /alephium/.env"
    cp $alphFile ./alephium/.env
fi

echo "guardian set init complete!"
