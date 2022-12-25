#!/usr/bin/env bash

NETWORKS=('mainnet' 'testnet' 'devnet')

network=$1

if [ -z "${network// }" ]
then
    echo "Please specify the network type"
    exit 1
fi

set -euo pipefail xtrace

VERSION=0.2.81
export DOCKER_BUILDKIT=1

if [[ ${NETWORKS[*]}] =~ $network ]]
then
    echo "Build images on $network"
else
    echo "Network has to be one of ${NETWORKS[*]}"
    exit 1
fi

docker build -f Dockerfile.init . -t eu.gcr.io/alephium-org/devnet-init:$VERSION

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f Dockerfile.proto -o type=local,dest=. .

# Build guardian image (used for both guardian & spy)
docker build -f ./node/Dockerfile . -t eu.gcr.io/alephium-org/guardiand:$VERSION --build-arg network=$network

## Build eth-node image
docker build -f ./ethereum/Dockerfile . -t eu.gcr.io/alephium-org/eth-node:$VERSION

docker build -f ./alephium/Dockerfile . -t eu.gcr.io/alephium-org/alephium-contracts:$VERSION

## Build Bridge UI
docker build -f ./bridge_ui/Dockerfile . -t eu.gcr.io/alephium-org/bridge-ui:$VERSION --build-arg network=$network

## Build Wormhole Explorer
docker build -f ./explorer/Dockerfile . -t eu.gcr.io/alephium-org/wormhole-explorer:$VERSION
