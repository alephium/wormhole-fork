# Example Token Bridge UI

## Prerequisites

- Docker
- NodeJS v14+
- NPM v7.18+

Run the following from the root of this repo

```bash
DOCKER_BUILDKIT=1 docker build --target node-export -f docker/Dockerfile.proto -o type=local,dest=. .
DOCKER_BUILDKIT=1 docker build -f solana/Dockerfile.wasm -o type=local,dest=. solana
npm ci --prefix ethereum
npm ci --prefix sdk/js
npm run build --prefix sdk/js
```

### Devnet

```bash
./build-docker-images.sh devnet latest
```

From docker directory:
```bash
MONGO_USER=root MONGO_PASSWORD=123456 docker compose up # include "--profile relayer up" for a relayer
REACT_APP_CLUSTER=devnet npm run start
```

The remaining steps can be run from this folder

## Install

```bash
npm ci
```

## Develop

```bash
npm start
```

## Build for local tilt network

```bash
npm run build
```

## Build for testnet

```bash
REACT_APP_CLUSTER=testnet npm run build
```

## Build for mainnet

```bash
REACT_APP_CLUSTER=mainnet REACT_APP_COVALENT_API_KEY=YOUR_API_KEY REACT_APP_SOLANA_API_URL=YOUR_CUSTOM_RPC npm run build
```

## Test Server

```bash
npx serve -s build
```

## Environment Variables (optional)

Create `.env` from the sample file, then add your Covalent API key:

```bash
cp .env.sample .env
```
