#!/usr/bin/env bash

NETWORKS=('mainnet' 'testnet' 'devnet')

network=$1
version=$2
pushImage=${3:-false}

if [ -z "${network// }" ]
then
    echo "Please specify the network type"
    exit 1
fi

set -euo pipefail xtrace

echo pushImage: $pushImage

if [ "${pushImage}" = true ]
then
    echo "pushing... true"
else
    echo "pushing... false"
fi

export DOCKER_BUILDKIT=1

if [[ ${NETWORKS[*]}] =~ $network ]]
then
    echo "Build images on $network"
else
    echo "Network has to be one of ${NETWORKS[*]}"
    exit 1
fi

docker build -f ./docker/Dockerfile.init . -t eu.gcr.io/alephium-org/devnet-init:$version

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f ./docker/Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f ./docker/Dockerfile.proto -o type=local,dest=. .

# Build guardian image (used for both guardian & spy)
docker build -f ./node/Dockerfile . -t eu.gcr.io/alephium-org/guardiand:$version --build-arg network=$network

## Build eth-node image
docker build -f ./ethereum/Dockerfile . -t eu.gcr.io/alephium-org/eth-node:$version

docker build -f ./alephium/Dockerfile . -t eu.gcr.io/alephium-org/alephium-contracts:$version

## Build Bridge UI
docker build -f ./bridge_ui/Dockerfile . -t eu.gcr.io/alephium-org/bridge-ui-$network:$version --build-arg network=$network

## Build Explorer Images
### explorer-api-server
docker build -f ./explorer-api-server/Dockerfile . -t eu.gcr.io/alephium-org/wormhole-explorer-api-server:$version

### explorer-backend
docker build -f ./explorer-backend/Dockerfile . -t eu.gcr.io/alephium-org/wormhole-explorer-backend:$version

### explorer
docker build -f ./explorer/Dockerfile . -t eu.gcr.io/alephium-org/wormhole-explorer:$version

echo "finish building..."

if [ "${pushImage}" = true ]
then
    echo "pushing..."
    docker push eu.gcr.io/alephium-org/guardiand:$version
    docker push eu.gcr.io/alephium-org/bridge-ui-$network:$version
    docker push eu.gcr.io/alephium-org/wormhole-explorer:$version
fi
