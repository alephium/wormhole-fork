# syntax=docker.io/docker/dockerfile:1.3@sha256:42399d4635eddd7a9b8a24be879d2f9a930d0ed040a61324cfdf59ef1357b3b2
FROM node:lts-alpine@sha256:2ae9624a39ce437e7f58931a5747fdc60224c6e40f8980db90728de58e22af7c

# npm wants to clone random Git repositories - lovely.
RUN apk add git python make build-base

# Run as user, otherwise, npx explodes.
USER 1000
RUN mkdir -p /home/node/ethereum
RUN mkdir -p /home/node/.npm
RUN mkdir -p /home/node/configs
WORKDIR /home/node/ethereum

COPY --chown=node:node ./configs /home/node/configs

# Fix git ssh error
RUN git config --global url."https://".insteadOf ssh://

# Only invalidate the npm install step if package.json changed
ADD --chown=node:node ./ethereum/package.json .
ADD --chown=node:node ./ethereum/package-lock.json .

# We want to cache node_modules *and* incorporate it into the final image.
RUN --mount=type=cache,uid=1000,gid=1000,target=/home/node/.npm \
  --mount=type=cache,uid=1000,gid=1000,target=node_modules \
  npm ci && \
  cp -r node_modules node_modules_cache

# Amusingly, Debian's coreutils version has a bug where mv believes that
# the target is on a different fs and does a full recursive copy for what
# could be a renameat syscall. Alpine does not have this bug.
RUN rm -rf node_modules && mv node_modules_cache node_modules

ADD --chown=node:node ./ethereum .
