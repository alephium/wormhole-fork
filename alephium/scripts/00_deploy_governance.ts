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
  const messageFee = BigInt('100000000000000')
  const initialFields = {
    guardianSets: ['', currentGuardianSet],
    guardianSetIndexes: [0n, 0n],
    chainId: BigInt(network.settings.initChainId),
    governanceChainId: BigInt(network.settings.initGovChainId),
    governanceEmitterAddress: network.settings.initGovContract,
    receivedSequence: 0n,
    messageFee: messageFee,
    previousGuardianSetExpirationTimeMS: 0n
  }

  console.log('governance initialFields', initialFields)
  console.log('goverance code hash', governance.codeHash)

  const result = await deployer.deployContract(governance, {
    initialFields: initialFields
  })
  console.log(`Governance contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployGovernance
