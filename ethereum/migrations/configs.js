const ethDevnetConfig = require('../../configs/ethereum/devnet.json')
const ethTestnetConfig = require('../../configs/ethereum/testnet.json')
const ethMainnetConfig = require('../../configs/ethereum/mainnet.json')
const guardianDevnetConfig = require('../../configs/guardian/devnet.json')
const guardianTestnetConfig = require('../../configs/guardian/testnet.json')
const guardianMainnetConfig = require('../../configs/guardian/mainnet.json')

var config = undefined

function addPrefix(value) {
  const str = value.toString()
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return str
  }
  return '0x' + str
}

function numberToHex(value) {
  return '0x' + value.toString(16)
}

function isDevnet(network) {
  return !isTestnet(network) && !isMainnet(network)
}

function isTestnet(network) {
  return network === 'goerli' || network === 'goerli-fork'
}

function isMainnet(network) {
  return network === 'mainnet' || network === 'mainnet-fork'
}

function getDeploymentsFileName(network) {
  return isDevnet(network)
    ? '.deployments.devnet.json'
    : isTestnet(network)
    ? '.deployments.testnet.json'
    : isMainnet(network)
    ? '.deployments.mainnet.json'
    : invalidNetwork(network)
}

function getWETHAddress(network) {
  return isDevnet(network)
    ? artifacts.require("MockWETH9").address
    : isTestnet(network)
    ? ethTestnetConfig.contracts.weth // weth address on goerli testnet
    : isMainnet(network)
    ? ethMainnetConfig.contracts.weth // weth address on ethereum mainnet
    : invalidNetwork(network)
}

function invalidNetwork(network) {
  throw new Error(`Invalid network: ${network}`)
}

function loadConfigs(network) {
  if (config !== undefined) {
    return config
  }

  const [ethConfig, guardianConfig] = isDevnet(network)
    ? [ethDevnetConfig, guardianDevnetConfig]
    : isTestnet(network)
    ? [ethTestnetConfig, guardianTestnetConfig]
    : isMainnet(network)
    ? [ethMainnetConfig, guardianMainnetConfig]
    : invalidNetwork(network)
  return {
    chainId: numberToHex(ethConfig.chainId),
    governanceChainId: numberToHex(guardianConfig.governanceChainId),
    governanceEmitterAddress: addPrefix(guardianConfig.governanceEmitterAddress),
    initSigners: guardianConfig.initSigners.map(signer => addPrefix(signer)),
  }
}

module.exports = { loadConfigs, getDeploymentsFileName, getWETHAddress, isDevnet }
