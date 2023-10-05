# Local Devnet

The following dependencies are required for local development:

- [Go](https://golang.org/dl/) >= 1.18.6
- [Docker](https://docs.docker.com/engine/install/)

# Setup local cluster

Build the docker images:

```sh
git clone git@github.com:alephium/wormhole-fork.git
cd wormhole-fork/
./build-docker-images.sh latest devnet
```

Start the devnet:

```
cd ./docker
MONGO_USER=user MONGO_PASSWORD=password docker compose up
```

This command will run one guardian by default, you can also specify the number of guardians through the environment variable `NUM_OF_GUARDIANS`, note that currently devnet supports up to 3 guardians:

```sh
MONGO_USER=user MONGO_PASSWORD=password NUM_OF_GUARDIANS=3 docker compose up
```

And wait for all containers to start.

# Devnet accounts and contracts

Alephium account mnemonic: vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava
Ethereum account private-key: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d

Please refer to `configs/alephium/devnet.json` and `configs/ethereum/devnet.json` for other contract IDs.

# Cleanup the cluster

```sh
docker compose down
docker volume prune
```

Note: remember to re-import the Ethereum wallet after cleaning the cluster.
