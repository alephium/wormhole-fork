const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    devnet: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    ethDocker: {
      host: "eth-devnet",
      port: 8545,
      network_id: "*",
    },
    bscDocker: {
      host: "bsc-devnet",
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
      gasPrice: 20000000000,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: false,
    },
    sepolia: {
      provider: () => {
        return new HDWalletProvider({
          mnemonic: {
            phrase: process.env.MNEMONIC,
          },
          providerOrUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
          pollingInterval: 8000,
        });
      },
      network_id: "11155111",
      gasPrice: 30000000000,
      deploymentPollingInterval: 8000,
      confirmations: 1,
    },
    bscTestnet: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, 'https://bsc-testnet-rpc.publicnode.com'),
      network_id: "97",
      networkCheckTimeout: 50000,
      confirmations: 1,
    },
    bscMainnet: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, 'https://bsc-rpc.publicnode.com'),
      network_id: "56",
      networkCheckTimeout: 50000,
      confirmations: 1,
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
