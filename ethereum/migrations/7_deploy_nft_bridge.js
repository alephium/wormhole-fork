const configs = require('./configs')

const NFTBridge = artifacts.require("NFTBridgeEntrypoint");
const NFTBridgeImplementation = artifacts.require("NFTBridgeImplementation");
const NFTBridgeSetup = artifacts.require("NFTBridgeSetup");
const NFTTokenImplementation = artifacts.require("NFTImplementation");
const Wormhole = artifacts.require("Wormhole");

module.exports = async function (deployer) {
    // deploy token implementation
    await deployer.deploy(NFTTokenImplementation);

    // deploy setup
    await deployer.deploy(NFTBridgeSetup);

    // deploy implementation
    await deployer.deploy(NFTBridgeImplementation);

    // encode initialisation data
    const setup = new web3.eth.Contract(NFTBridgeSetup.abi, NFTBridgeSetup.address);
    const config = configs.loadConfigs(deployer.network)
    const initData = setup.methods.setup(
        NFTBridgeImplementation.address,
        config.chainId,
        (await Wormhole.deployed()).address,
        config.governanceChainId,
        config.governanceEmitterAddress,
        NFTTokenImplementation.address
    ).encodeABI();

    // deploy proxy
    await deployer.deploy(NFTBridge, NFTBridgeSetup.address, initData);
};
