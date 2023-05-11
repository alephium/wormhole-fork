# Local Devnet

The following dependencies are required for local development:

- [Go](https://golang.org/dl/) >= 1.18.6
- [Tilt](http://tilt.dev/) >= 0.20.8
- [minikube](https://kubernetes.io/docs/setup/learning-environment/minikube/)
- [Docker](https://docs.docker.com/engine/install/)

# Setup local cluster

```sh
git clone git@github.com:alephium/wormhole-fork.git
cd wormhole-fork
```

```sh
minikube start --driver=docker --cpus=8 --memory=8G --disk-size=50g --namespace=wormhole
```

Launch the devnet while specifying the number of guardians nodes to run:

```sh
tilt up -- --num=1 --webHost=0.0.0.0 --bridge_ui
```

And wait for all pods to start.

# Devnet accounts and contracts

Alephium account mnemonic: vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava
Ethereum account private-key: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d

Please refer to `configs/alephium/devnet.json` and `configs/ethereum/devnet.json` for other contract IDs.

# Cleanup the cluster

```sh
tilt down
```

Note: remember to re-import the Ethereum wallet after cleaning the cluster.
