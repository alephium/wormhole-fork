FROM node:16-bullseye-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/* && \
    mkdir /relayer-engine && mkdir /configs

COPY ./configs /configs
COPY ./relayer-engine/src /relayer-engine/src
COPY ./relayer-engine/package.json /relayer-engine/package.json
COPY ./relayer-engine/package-lock.json /relayer-engine/package-lock.json
COPY ./relayer-engine/tsconfig.json /relayer-engine/tsconfig.json

WORKDIR /relayer-engine

RUN --mount=type=cache,target=/home/node/.npm \
    npm ci && npm run build
