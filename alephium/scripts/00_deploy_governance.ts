import { Project } from '@alephium/web3'
import { Deployer, DeployFunction, Network } from '../lib/deployment'
import { zeroPad } from '../lib/utils'
import * as dotenv from 'dotenv'
import { Settings } from '../configuration'

dotenv.config({ path: __dirname + '/../.env' })

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
    guardianSetIndexes: [0, 0],
    chainId: network.settings.initChainId,
    governanceChainId: network.settings.initGovChainId,
    governanceEmitterAddress: network.settings.initGovContract,
    receivedSequence: 0,
    messageFee: messageFee,
    previousGuardianSetExpirationTimeMS: 0
  }

  const result = await deployer.deployContract(governance, {
    initialFields: initialFields
  })
  console.log(`Governance contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployGovernance
