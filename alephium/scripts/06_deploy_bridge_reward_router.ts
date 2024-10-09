import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { MINIMAL_CONTRACT_DEPOSIT } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { BridgeRewardRouterV2 } from '../artifacts/ts'

const deployBridgeRewardRouter: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const result = await deployer.deployContract(BridgeRewardRouterV2, {
    initialFields: {
      alphChainId: BigInt(network.settings.chainId),
      rewardAmount: network.settings.rewardAmount,
      owner: deployer.account.address
    },
    initialAttoAlphAmount: MINIMAL_CONTRACT_DEPOSIT + network.settings.initALPHAmountInRouterContract
  })
  console.log(
    `BridgeRewardRouterV2 contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`
  )
}

export default deployBridgeRewardRouter
