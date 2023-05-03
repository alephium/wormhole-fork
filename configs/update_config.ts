import path from 'path'
import fs from 'fs'

const ALPHTokenId = ''.padStart(64, '0')

function updateConfig(
  baseDir: string,
  network: string,
  chain: string,
  func: (deployments: any, config: any) => void
) {
  const deploymentsPath = path.join(baseDir, `.deployments.${network}.json`)
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Deployments ${deploymentsPath} does not exist`)
  }
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath).toString())
  const configPath = path.join(process.cwd(), chain, `${network}.json`)
  const config = JSON.parse(fs.readFileSync(configPath).toString())
  func(deployments, config)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

function updateEthConfig(network: string) {
  const ethDir = path.join(process.cwd(), '..', 'ethereum')
  const truffleConfigPath = path.join(ethDir, 'truffle-config.js')
  const truffleConfig = require(truffleConfigPath)
  const networkConfig = truffleConfig.networks[`${network}`]
  const nodeUrl = `${networkConfig.host}:${networkConfig.port}`

  const func = (deployments: any, config: any): void => {
    config.nodeUrl = nodeUrl
    config.contracts = deployments
    config.coreEmitterAddress = (deployments.governance as string).slice(2).padStart(64, '0')
    config.tokenBridgeEmitterAddress = (deployments.tokenBridge as string).slice(2).padStart(64, '0')
    const bridgeTokens = [deployments.weth]
    if (deployments.testToken) {
      bridgeTokens.push(deployments.testToken)
    }
    config.bridgeTokens = bridgeTokens
  }

  updateConfig(ethDir, network, 'ethereum', func)
}

function updateAlphConfig(network: string) {
  const func = (deployments: any, config: any): void => {
    const contracts: any = {
      governance: deployments.contracts.Governance.contractInstance.contractId,
      nativeGovernance: deployments.contracts.Governance.contractInstance.address,
      tokenBridge: deployments.contracts.TokenBridge.contractInstance.contractId,
      nativeTokenBridge: deployments.contracts.TokenBridge.contractInstance.address
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
  updateConfig(alphDir, network, 'alephium', func)
}

const network = process.argv[2]
if (network !== 'devnet' && network !== 'testnet' && network !== 'mainnet') {
  console.log(`Network has to be one of ['devnet', 'testnet', 'mainnet']`)
  process.exit(-1)
}

updateEthConfig(network)
updateAlphConfig(network)
