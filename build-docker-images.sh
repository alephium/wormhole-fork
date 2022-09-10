#!/usr/bin/env bash

set -e

NUM_GUARDIANS=1

export DOCKER_BUILDKIT=1

# Build proto-gen, generate node/pkg/proto dir
docker build --target go-export -f Dockerfile.proto -o type=local,dest=node .

# Build proto-gen-web
docker build --target node-export -f Dockerfile.proto -o type=local,dest=. .

# Build const-gen
tilt docker build -- --target const-export -f Dockerfile.const -o type=local,dest=. --build-arg num_guardians=$NUM_GUARDIANS .

# Build guardian image (used for both guardian & spy)
pushd node
docker build . -t liuhongchao/guardiand:0.0.3
popd

# Build eth-node image
pushd ethereum
docker build . -t liuhongchao/eth-node:0.0.3
popd

# How to deploy contracts for ALPH?
# npx ts-node commands.ts deploy -n devnet
pushd alephium
docker build -f Dockerfile.automine . -t liuhongchao/automine:0.0.3
popd

# Build Bridge UI
pushd bridge_ui
docker build . -t liuhongchao/bridge-ui:0.0.5
popd