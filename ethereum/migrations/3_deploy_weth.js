const WETH9 = artifacts.require("MockWETH9");
const configs = require('./configs')

module.exports = async function(deployer) {
  if (configs.isDevnet(deployer.network)) {
    const chainName = configs.getChainName()
    if (chainName === 'ethereum') {
      await deployer.deploy(WETH9, 'Wrapped Ether', 'WETH')
    } else if (chainName === 'bsc') {
      await deployer.deploy(WETH9, 'Wrapped BNB', 'WBNB')
    } else {
      throw new Error(`Invalid chain name: ${chainName}`)
    }
  }
};
