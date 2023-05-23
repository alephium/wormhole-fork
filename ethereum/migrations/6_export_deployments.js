const configs = require('./configs')
const path = require('path')
const fs = require('fs')

module.exports = async function(deployer) {
  const Wormhole = artifacts.require("Wormhole")
  const TokenBridge = artifacts.require("TokenBridge")
  const deployments = {
    governance: Wormhole.address,
    tokenBridge: TokenBridge.address,
    wrappedNative: configs.getWrappedNativeAddress(deployer.network)
  }
  if (configs.isDevnet(deployer.network)) {
    const ERC20 = artifacts.require("ERC20PresetMinterPauser");
    deployments.testToken = ERC20.address
  }

  const fileName = configs.getDeploymentsFileName(deployer.network)
  const filePath = path.join(process.cwd(), fileName)
  const content = JSON.stringify(deployments, null, 2)
  fs.writeFileSync(filePath, content)
};
