import path from 'path'
import fs from 'fs'

const ALPHTokenId = ''.padStart(64, '0')

function updateConfig(
  deploymentsPath: string,
  network: string,
  chain: string,
  func: (deployments: any, config: any) => void
) {
  if (!fs.existsSync(deploymentsPath)) {
    console.log(`ERROR: deployments ${deploymentsPath} does not exist`)
    return
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath).toString())
  const configPath = path.join(process.cwd(), chain, `${network}.json`)
  const config = JSON.parse(fs.readFileSync(configPath).toString())
  func(deployments, config)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function updateEvmConfig(network: string, chainName: string) {
  const func = (deployments: any, config: any): void => {
    config.contracts = deployments
    config.coreEmitterAddress = (deployments.governance as string).slice(2).padStart(64, '0')
    config.tokenBridgeEmitterAddress = (deployments.tokenBridge as string).slice(2).padStart(64, '0')
    const bridgeTokens = [deployments.wrappedNative]
    if (deployments.testToken) {
      bridgeTokens.push(deployments.testToken)
    }
    config.bridgeTokens = bridgeTokens
  }

  const contractDir = path.join(process.cwd(), '..', 'ethereum')
  const deploymentsPath = path.join(contractDir, `.deployments.${chainName}.${network}.json`)
  updateConfig(deploymentsPath, network, chainName, func)
}

function updateEthConfig(network: string) {
  updateEvmConfig(network, 'ethereum')
}

function updateBscConfig(network: string) {
  updateEvmConfig(network, 'bsc')
}

function updateAlphConfig(network: string) {
  const func = (deployments: any, config: any): void => {
    const contracts: any = {
      governance: deployments.contracts.Governance.contractInstance.contractId,
      nativeGovernance: deployments.contracts.Governance.contractInstance.address,
      tokenBridge: deployments.contracts.TokenBridge.contractInstance.contractId,
      nativeTokenBridge: deployments.contracts.TokenBridge.contractInstance.address,
      bridgeRewardRouter: deployments.contracts.BridgeRewardRouter.contractInstance.contractId
    }
    const bridgeTokens = [ALPHTokenId]
    if (deployments.contracts.TestToken !== undefined) {
      contracts.testToken = deployments.contracts.TestToken.contractInstance.contractId
      bridgeTokens.push(deployments.contracts.TestToken.contractInstance.contractId)
    }
    config.contracts = contracts
    config.coreEmitterAddress = contracts.governance
    config.tokenBridgeEmitterAddress = contracts.tokenBridge
    config.bridgeTokens = bridgeTokens
  }

  const alphDir = path.join(process.cwd(), '..', 'alephium', 'artifacts')
  const deploymentsPath = path.join(alphDir, `.deployments.${network}.json`)
  updateConfig(deploymentsPath, network, 'alephium', func)
}

const network = process.argv[2]
if (network !== 'devnet' && network !== 'testnet' && network !== 'mainnet') {
  console.log(`Network has to be one of ['devnet', 'testnet', 'mainnet']`)
  process.exit(-1)
}

updateEthConfig(network)
updateAlphConfig(network)
updateBscConfig(network)
