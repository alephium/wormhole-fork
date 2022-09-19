import { Project, Script } from '@alephium/web3'
import { Deployer, DeployFunction, Network } from '@alephium/cli/types'
import { Settings } from '../alephium.config'

const oneAlph = BigInt('1000000000000000000')

async function registerWithVAA(deployer: Deployer, script: Script, tokenBridge: string, vaa: string, taskTag: string) {
  const initialFields = {
    payer: deployer.account.address,
    tokenBridge: tokenBridge,
    vaa: vaa,
    alphAmount: oneAlph
  }
  await deployer.runScript(
    script,
    {
      initialFields: initialFields
    },
    taskTag
  )
}

const registerChain: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractId
  const script = Project.script('RegisterChain')
  const registerETHVAA = network.settings.registerETHVAA
  await registerWithVAA(deployer, script, tokenBridgeId, registerETHVAA, 'ETH')
  const registerBSCVAA = network.settings.registerBSCVAA
  await registerWithVAA(deployer, script, tokenBridgeId, registerBSCVAA, 'BSC')
}

export default registerChain
