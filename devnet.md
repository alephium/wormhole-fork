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
tilt up -- --num=1 --webHost=0.0.0.0
```

And wait for all pods to start.

# Bridge ui

Because we haven't released the sdk yet, we need to start bridge ui outside k8s cluster, build sdk first:

```sh
cd ethereum
npm install && npm run build

cd sdk/js
npm install && npm run build
```

build and run bridge ui:

```sh
cd bridge_ui
npm install && npm run start
```

# Devnet accounts and contracts

Alephium account address: 1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH
Alephium test token contract id: d3ca6210463e0ec3d56d8fc7b943c4d51462a3ca617d5359b69269b476e35d0f, address: 28wh8EY3bKieMekpAk91QoTTjoBzVUp2AcSsUwX7C4rtv
Alephium wrapped alph contract id: 60507692e3b8f707b2d00d74b614a453d13b43171c808b4ecaad21e8b50d5a4a, address: 21AvQx2W29NsY2XttTZiqxSmYytAKHNi5kWZqtqax99ds

Ethereum account private-key: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d
Ethereum test token address: 0x2D8BE6BF0baA74e0A907016679CaE9190e80dD0A
Ethereum weth address: 0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E

# Cleanup the cluster

```sh
tilt down
```

Note: remember to re-import the Ethereum wallet after cleaning the cluster.
