#!/usr/bin/env bash

set -e

NUM_GUARDIANS=1

export DOCKER_BUILDKIT=1

VERSION=0.2.56

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f Dockerfile.proto -o type=local,dest=. .

# Build const-gen
docker build --target const-export -f Dockerfile.const -o type=local,dest=. --build-arg num_guardians=$NUM_GUARDIANS .

# Build guardian image (used for both guardian & spy)
pushd node
docker build . -t wormhole/guardiand:$VERSION
popd

## Build eth-node image
pushd ethereum
cp .env.test .env
git apply 1conf.patch
git apply truffle-config.patch
docker build . -t wormhole/eth-node:$VERSION
git apply -R 1conf.patch
git apply -R truffle-config.patch
popd

pushd alephium
docker build -f Dockerfile.automine . -t wormhole/automine:$VERSION
popd

## Build Bridge UI
pushd bridge_ui
docker build . -t wormhole/bridge-ui:$VERSION
popd

## Build Wormhole Explorer
pushd explorer
docker build . -t wormhole/wormhole-explorer:$VERSION
popd
