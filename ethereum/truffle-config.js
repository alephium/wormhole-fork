const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    devnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    docker: {
      host: "eth-devnet",
      port: 8545,
      network_id: "*",
    },
    // test network is the same as devnet but allows us to omit certain migrations
    test: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://mainnet.infura.io/v3/` + process.env.INFURA_KEY
        ),
      network_id: 1,
      gas: 10000000,
      gasPrice: 191000000000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: false,
    },
    goerli: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          "wss://goerli.infura.io/ws/v3/" + process.env.INFURA_KEY
        );
      },
      network_id: "5",
      gas: 4465030,
      gasPrice: 10000000000,
    }
  },

  compilers: {
    solc: {
      version: "0.8.4",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  plugins: ["@chainsafe/truffle-plugin-abigen", "truffle-plugin-verify"],

  api_keys: {
    etherscan: process.env.ETHERSCAN_KEY,
  },
};
