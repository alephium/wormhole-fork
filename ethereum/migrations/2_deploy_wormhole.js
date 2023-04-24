const configs = require('./configs')

const Setup = artifacts.require("Setup");
const Implementation = artifacts.require("Implementation");
const Wormhole = artifacts.require("Wormhole");

module.exports = async function (deployer) {
    // deploy setup
    await deployer.deploy(Setup);

    // deploy implementation
    await deployer.deploy(Implementation);

    // encode initialisation data
    const setup = new web3.eth.Contract(Setup.abi, Setup.address);
    const config = configs.loadConfigs(deployer.network)
    const initData = setup.methods.setup(
        Implementation.address,
        config.initSigners,
        config.chainId,
        config.governanceChainId,
        config.governanceEmitterAddress
    ).encodeABI();

    // deploy proxy
    await deployer.deploy(Wormhole, Setup.address, initData);
};
