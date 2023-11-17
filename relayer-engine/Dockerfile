FROM node:16-buster-slim@sha256:93c9fc3550f5f7d159f282027228e90e3a7f8bf38544758024f005e82607f546

RUN mkdir /relayer-engine && mkdir /configs

COPY ./configs /configs
COPY ./relayer-engine/src /relayer-engine/src
COPY ./relayer-engine/package.json /relayer-engine/package.json
COPY ./relayer-engine/package-lock.json /relayer-engine/package-lock.json
COPY ./relayer-engine/tsconfig.json /relayer-engine/tsconfig.json

WORKDIR /relayer-engine

RUN --mount=type=cache,target=/home/node/.npm \
    npm ci && npm run build