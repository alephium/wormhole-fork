import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import { zeroPad } from "../lib/utils"
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../.env' })

const deployGovernance = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const governance = Project.contract("Governance")
  const initGuardianSet = JSON.parse(process.env.INIT_SIGNERS!) as string[]
  const sizePrefix = zeroPad(initGuardianSet.length.toString(16), 1)
  const currentGuardianSet = sizePrefix + initGuardianSet.join('')
  const messageFee = BigInt("100000000000000")
  const initialFields = {
    'guardianSets': Array('', currentGuardianSet),
    'guardianSetIndexes': Array(0, 0),
    'chainId': parseInt(process.env.INIT_CHAIN_ID!),
    'governanceChainId': parseInt(process.env.INIT_GOV_CHAIN_ID!),
    'governanceEmitterAddress': process.env.INIT_GOV_CONTRACT!,
    'receivedSequence': 0,
    'messageFee': messageFee,
    'previousGuardianSetExpirationTimeMS': 0
  }

  const result = await deployer.deployContract(governance, {
    initialFields: initialFields
  })
  console.log(`Governace contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployGovernance
