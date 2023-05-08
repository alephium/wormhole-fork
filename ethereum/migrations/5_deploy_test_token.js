const ERC20 = artifacts.require("ERC20PresetMinterPauser");
const configs = require('./configs')

module.exports = async function(deployer) {
  if (!configs.isDevnet(deployer.network)) {
    return
  }

  await deployer.deploy(ERC20, 'Ethereum Test Token', 'TKN')
  const config = configs.loadConfigs(deployer.network)
  config.testToken = ERC20.address

  const accounts = await web3.eth.getAccounts()
  const token = new web3.eth.Contract(ERC20.abi, ERC20.address)
  // mint 1000 units
  await token.methods.mint(accounts[0], "1000000000000000000000").send({
    from: accounts[0],
    gas: 1000000,
  })
};
