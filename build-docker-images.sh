#!/usr/bin/env bash

set -e

NUM_GUARDIANS=1

export DOCKER_BUILDKIT=1

VERSION=0.1.3

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f Dockerfile.proto -o type=local,dest=. .

# Build const-gen
docker build --target const-export -f Dockerfile.const -o type=local,dest=. --build-arg num_guardians=$NUM_GUARDIANS .

# Build guardian image (used for both guardian & spy)
pushd node
docker build . -t liuhongchao/guardiand:$VERSION
popd

# Build eth-node image
pushd ethereum
docker build . -t liuhongchao/eth-node:$VERSION
popd

# How to deploy contracts for ALPH?
# npx ts-node commands.ts deploy -n devnet
pushd alephium
docker build -f Dockerfile.automine . -t liuhongchao/automine:$VERSION
popd

# Build Bridge UI
pushd bridge_ui
docker build . -t liuhongchao/bridge-ui:$VERSION
popd
