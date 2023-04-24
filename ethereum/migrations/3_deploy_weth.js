const WETH9 = artifacts.require("MockWETH9");
const configs = require('./configs')

module.exports = async function(deployer) {
  if (configs.isDevnet(deployer.network)) {
    await deployer.deploy(WETH9)
  }
};
