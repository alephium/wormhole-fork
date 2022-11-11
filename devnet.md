# Local Devnet

The following dependencies are required for local development:

- [Go](https://golang.org/dl/) >= 1.17.5 (go 1.18.x has some issues)
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

Alephium account address: 1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH
Alephium test token contract id: 6c9e363a430b14f135428ea6d7a5b1cf893485ab9495e325258e7b16925d62ab, address: 21zx4ryc9Qwe6CKoAahKKDfSLQtxGdVQJNCxTswmmVTbp
Alephium wrapped alph contract id: 7eba0bd8a081d080d708fd226f6da27d59574e465b3703b563ed990260e56803, address: 23De2HETiehDAm4jGyzFoRCdVa4UxMP9a4F5DqnL5hW2N

Ethereum account private-key: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
Ethereum test token address: 0x2D8BE6BF0baA74e0A907016679CaE9190e80dD0A
Ethereum weth address: 0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E

# Cleanup the cluster

```sh
tilt down
```

Note: remember to re-import the Ethereum wallet after cleaning the cluster.
