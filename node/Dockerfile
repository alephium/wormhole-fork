# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2
FROM docker.io/golang:1.19.2@sha256:0467d7d12d170ed8d998a2dae4a09aa13d0aa56e6d23c4ec2b1e4faacf86a813

Arg network

# Support additional root CAs
COPY ./node/go.mod ./node/cert.pem* /certs/
# Debian
RUN if [ -e /certs/cert.pem ]; then cp /certs/cert.pem /etc/ssl/certs/ca-certificates.crt; fi
# git
RUN if [ -e /certs/cert.pem ]; then git config --global http.sslCAInfo /certs/cert.pem; fi

RUN mkdir /configs
COPY ./configs /configs

WORKDIR /app

ADD ./node/tools tools

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  cd tools/ && go build -mod=readonly -o /dlv github.com/go-delve/delve/cmd/dlv

ADD ./node .

RUN if [ "$network" != "devnet" ]; then apt-get update && apt-get install libcap2-bin -y; fi

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  go build -gcflags="all=-N -l" --ldflags '-extldflags "-Wl,--allow-multiple-definition"' -mod=readonly -o /guardiand github.com/alephium/wormhole-fork/node

RUN if [ "$network" != "devnet" ]; then setcap cap_ipc_lock=+ep /guardiand; fi

ENTRYPOINT /guardiand
