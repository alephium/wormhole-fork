# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2
FROM docker.io/golang:1.18.6@sha256:60dd47f8883de5cf2af2e2c5e00bdf4a304d39af63e617ac559671f9f87982f5

# Support additional root CAs
COPY go.mod cert.pem* /certs/
# Debian
RUN if [ -e /certs/cert.pem ]; then cp /certs/cert.pem /etc/ssl/certs/ca-certificates.crt; fi
# git
RUN if [ -e /certs/cert.pem ]; then git config --global http.sslCAInfo /certs/cert.pem; fi

WORKDIR /app

ADD tools tools

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  cd tools/ && go build -mod=readonly -o /dlv github.com/go-delve/delve/cmd/dlv

ADD . .

RUN apt-get update
RUN apt-get install libcap2-bin -y

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  go build -race -gcflags="all=-N -l" --ldflags '-extldflags "-Wl,--allow-multiple-definition"' -mod=readonly -o /guardiand github.com/certusone/wormhole/node

RUN setcap cap_ipc_lock=+ep /guardiand

ENTRYPOINT /guardiand
