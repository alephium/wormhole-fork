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
  return network === 'sepolia' || network === 'sepolia-fork' || network === 'bscTestnet'
}

function isMainnet(network) {
  return network === 'mainnet' || network === 'mainnet-fork' || network === 'bscMainnet'
}

function getDeploymentsFileName(network) {
  const chainName = getChainName()
  return isDevnet(network)
    ? `.deployments.${chainName}.devnet.json`
    : isTestnet(network)
    ? `.deployments.${chainName}.testnet.json`
    : isMainnet(network)
    ? `.deployments.${chainName}.mainnet.json`
    : invalidNetwork(network)
}

function getWrappedNativeAddress(network) {
  const chainConfig = getChainConfig(network)
  return isDevnet(network)
    ? artifacts.require("MockWETH9").address
    : chainConfig.contracts.wrappedNative
}

function invalidNetwork(network) {
  throw new Error(`Invalid network: ${network}`)
}

const evmChainNames = ['ethereum', 'bsc']

function getChainName() {
  if (process.env.CHAIN_NAME && evmChainNames.includes(process.env.CHAIN_NAME)) {
    return process.env.CHAIN_NAME
  }
  throw new Error(`No chain name specified, please specify CHAIN_NAME env`)
}

function getChainConfig(network) {
  const chainName = getChainName()
  return isDevnet(network)
    ? require(`../../configs/${chainName}/devnet.json`)
    : isTestnet(network)
    ? require(`../../configs/${chainName}/testnet.json`)
    : isMainnet(network)
    ? require(`../../configs/${chainName}/mainnet.json`)
    : invalidNetwork(network)
}

function getGuardianConfig(network) {
  return isDevnet(network)
    ? require('../../configs/guardian/devnet.json')
    : isTestnet(network)
    ? require('../../configs/guardian/testnet.json')
    : isMainnet(network)
    ? require('../../configs/guardian/mainnet.json')
    : invalidNetwork(network)
}

function loadConfigs(network) {
  if (config !== undefined) {
    return config
  }

  const chainConfig = getChainConfig(network)
  const guardianConfig = getGuardianConfig(network)
  return {
    chainId: numberToHex(chainConfig.chainId),
    governanceChainId: numberToHex(guardianConfig.governanceChainId),
    governanceEmitterAddress: addPrefix(guardianConfig.governanceEmitterAddress),
    initSigners: guardianConfig.initSigners.map(signer => addPrefix(signer)),
  }
}

module.exports = { loadConfigs, getDeploymentsFileName, getWrappedNativeAddress, isDevnet, getChainName }
