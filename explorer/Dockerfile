# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2

# Derivative of ethereum/Dockerfile, look there for an explanation on how it works.
FROM node:16-alpine@sha256:004dbac84fed48e20f9888a23e32fa7cf83c2995e174a78d41d9a9dd1e051a20

RUN mkdir -p /app && mkdir /configs
WORKDIR /app
COPY ./configs /configs

ADD ./explorer/package.json .
ADD ./explorer/package-lock.json .
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  npm ci

ADD ./explorer .

ARG network="mainnet"
ENV GATSBY_DEFAULT_NETWORK=$network
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  npm run build
