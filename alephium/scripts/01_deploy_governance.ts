import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { zeroPad } from '../lib/utils'
import { Settings } from '../alephium.config'
import { Governance } from '../artifacts/ts'

function removePrefix(str: string): string {
  if (str.startsWith('0x') || str.startsWith('0X')) {
    return str.slice(2)
  }
  return str
}

const deployGovernance: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const initGuardianSet = network.settings.initSigners.map(removePrefix)
  if (initGuardianSet.length === 0) {
    throw new Error('empty init guardian set')
  }
  const sizePrefix = zeroPad(initGuardianSet.length.toString(16), 1)
  const currentGuardianSet = sizePrefix + initGuardianSet.join('')
  console.log(`init guardian set: ${currentGuardianSet}`)
  const tokenBridgeFactoryId = deployer.getDeployContractResult('TokenBridgeFactory').contractInstance.contractId
  const initialFields = {
    guardianSets: ['', currentGuardianSet],
    guardianSetIndexes: [0n, 0n],
    chainId: BigInt(network.settings.chainId),
    tokenBridgeFactory: tokenBridgeFactoryId,
    governanceChainId: BigInt(network.settings.governanceChainId),
    governanceEmitterAddress: network.settings.governanceEmitterAddress,
    receivedSequence: 0n,
    messageFee: network.settings.messageFee,
    previousGuardianSetExpirationTimeMS: 0n
  }

  const result = await deployer.deployContract(Governance, { initialFields: initialFields })
  console.log(
    `Governance contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`
  )
}

export default deployGovernance
