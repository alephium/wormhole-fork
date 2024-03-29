# Makefile for production builds. This is not meant, or optimized, for incremental or debug builds. Use the devnet for
# development. For the sake of decentralization, we specifically avoid the use of prebuilt containers wherever possible
# to increase diversity - operators sourcing their compiler binaries from different sources is a good thing.

SHELL = /usr/bin/env bash
MAKEFLAGS += --no-builtin-rules

PREFIX ?= /usr/local
OUT = build
BIN = $(OUT)/bin

-include Makefile.help

VERSION = $(shell git describe --tags --dirty)

.PHONY: dirs
dirs: Makefile
	@mkdir -p $(BIN)

.PHONY: install
## Install guardiand binary
install:
	install -m 775 $(BIN)/* $(PREFIX)/bin
	setcap cap_ipc_lock=+ep $(PREFIX)/bin/guardiand

.PHONY: generate
generate: dirs
	cd tools && ./build.sh
	rm -rf bridge
	rm -rf node/pkg/proto
	tools/bin/buf lint
	tools/bin/buf generate

.PHONY: generate-proto-sdk
generate-proto-sdk:
	cd tools && ./build.sh
	rm -rf sdk/js/src/proto
	tools/bin/buf generate --template buf.gen.web.yaml

.PHONY: node
## Build guardiand binary
node: $(BIN)/guardiand

.PHONY: guardian-test
guardian-test:
	cd node && go test -ldflags "-extldflags -Wl,--allow-multiple-definition" ./...

.PHONY: $(BIN)/guardiand
$(BIN)/guardiand: dirs generate
	@# The go-ethereum and celo-blockchain packages both implement secp256k1 using the exact same header, but that causes duplicate symbols.
	cd node && go build -ldflags "-X github.com/alephium/wormhole-fork/node/pkg/version.version=${VERSION} -extldflags -Wl,--allow-multiple-definition" \
	  -mod=readonly -o ../$(BIN)/guardiand \
	  github.com/alephium/wormhole-fork/node
