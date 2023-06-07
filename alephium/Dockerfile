FROM node:16-buster-slim@sha256:93c9fc3550f5f7d159f282027228e90e3a7f8bf38544758024f005e82607f546

RUN mkdir /alephium && mkdir /configs

WORKDIR /alephium

COPY ./configs /configs
COPY ./alephium .

RUN --mount=type=cache,target=/home/node/.npm \
    npm ci
