import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { ONE_ALPH } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { BridgeRewardRouter } from '../artifacts/ts'

const deployBridgeRewardRouter: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const result = await deployer.deployContract(BridgeRewardRouter, {
    initialFields: { alphChainId: BigInt(network.settings.chainId) },
    initialAttoAlphAmount: ONE_ALPH + network.settings.initRewards
  })
  console.log(
    `BridgeRewardRouter contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`
  )
}

export default deployBridgeRewardRouter
