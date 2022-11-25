import { Project } from '@alephium/web3'
import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { zeroPad } from '../lib/utils'
import { Settings } from '../alephium.config'

const deployGovernance: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const governance = Project.contract('Governance')
  const initGuardianSet = network.settings.initSigners
  const sizePrefix = zeroPad(initGuardianSet.length.toString(16), 1)
  const currentGuardianSet = sizePrefix + initGuardianSet.join('')
  const initialFields = {
    guardianSets: ['', currentGuardianSet],
    guardianSetIndexes: [0n, 0n],
    chainId: BigInt(network.settings.chainId),
    governanceChainId: BigInt(network.settings.governanceChainId),
    governanceEmitterAddress: network.settings.governanceEmitterAddress,
    receivedSequence: 0n,
    messageFee: network.settings.messageFee,
    previousGuardianSetExpirationTimeMS: 0n
  }

  const result = await deployer.deployContract(governance, {
    initialFields: initialFields
  })
  console.log(`Governance contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployGovernance
