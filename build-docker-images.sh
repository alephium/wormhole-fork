#!/usr/bin/env bash

NETWORKS=('mainnet' 'testnet' 'devnet')

network=$1

if [ -z "${network// }" ]
then
    echo "Please specify the network type"
    exit 1
fi

set -euo pipefail xtrace

VERSION=0.2.78
export DOCKER_BUILDKIT=1

if [[ ${NETWORKS[*]}] =~ $network ]]
then
    echo "Build images on $network"
else
    echo "Network has to be one of ${NETWORKS[*]}"
    exit 1
fi

docker build -f Dockerfile.init . -t alephium/devnet-init:$VERSION

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f Dockerfile.proto -o type=local,dest=. .

# Build guardian image (used for both guardian & spy)
pushd node
docker build . -t alephium/guardiand:$VERSION --build-arg network=$network
popd

## Build eth-node image
docker build -f ./ethereum/Dockerfile . -t alephium/eth-node:$VERSION

docker build -f ./alephium/Dockerfile . -t alephium/alephium-contracts:$VERSION

## Build Bridge UI
pushd bridge_ui
docker build . -t alephium/bridge-ui:$VERSION --build-arg network=$network
popd

## Build Wormhole Explorer
pushd explorer
docker build . -t alephium/wormhole-explorer:$VERSION
popd
