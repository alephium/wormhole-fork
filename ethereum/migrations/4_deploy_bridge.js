const configs = require('./configs')

const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementation = artifacts.require("BridgeImplementation");
const BridgeSetup = artifacts.require("BridgeSetup");
const TokenImplementation = artifacts.require("TokenImplementation");
const Wormhole = artifacts.require("Wormhole");

module.exports = async function (deployer) {
    // deploy token implementation
    await deployer.deploy(TokenImplementation);

    // deploy setup
    await deployer.deploy(BridgeSetup);

    // deploy implementation
    await deployer.deploy(BridgeImplementation);

    // encode initialisation data
    const setup = new web3.eth.Contract(BridgeSetup.abi, BridgeSetup.address);
    const config = configs.loadConfigs(deployer.network)
    const initData = setup.methods.setup(
        BridgeImplementation.address,
        config.chainId,
        (await Wormhole.deployed()).address,
        config.governanceChainId,
        config.governanceEmitterAddress,
        TokenImplementation.address,
        configs.getWETHAddress(deployer.network)
    ).encodeABI();

    // deploy proxy
    await deployer.deploy(TokenBridge, BridgeSetup.address, initData);
};
