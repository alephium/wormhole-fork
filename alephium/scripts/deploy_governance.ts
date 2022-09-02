import { addressFromContractId, Project, subContractId } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import { zeroPad } from "../lib/utils"
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../.env' })

const deployGovernance = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const governance = Project.contract('governance.ral')
  const initGuardianSet = JSON.parse(process.env.INIT_SIGNERS!) as string[]
  const sizePrefix = zeroPad(initGuardianSet.length.toString(16), 1)
  const currentGuardianSet = sizePrefix + initGuardianSet.join('')
  const messageFee = BigInt("100000000000000")
  const initFields = {
    'chainId': parseInt(process.env.INIT_CHAIN_ID!),
    'governanceChainId': parseInt(process.env.INIT_GOV_CHAIN_ID!),
    'governanceEmitterAddress': process.env.INIT_GOV_CONTRACT!,
    'receivedSequence': 0,
    'messageFee': messageFee,
    'previousGuardianSetExpirationTimeMS': 0
  }

  // TODO: remove devnet deployer once the contracts finalized
  if (networkType === "devnet") {
    const devnetDeployerId = deployer.getEnvironment('DevnetDeployer')
    const fields = {
      'guardianSet0': '',
      'guardianSet1': currentGuardianSet,
      'guardianSetIndex0': 0,
      'guardianSetIndex1': 0,
      ...initFields
    }

    const script = Project.script('devnet/deploy_governance.ral')
    await deployer.runScript(script, {
      initialFields: {
        'deployer': devnetDeployerId,
        'bytecode': governance.bytecode,
        ...fields
      }
    })
    const contractId = subContractId(devnetDeployerId, "00")
    const contractAddress = addressFromContractId(contractId)
    deployer.setEnvironment('Governance', contractId)
    console.log(`Governace contract address: ${contractAddress}, contract id: ${contractId}`)
  } else {
    const fields = {
      'guardianSets': Array('', currentGuardianSet),
      'guardianSetIndexes': Array(0, 0),
      ...initFields
    }
    const result = await deployer.deployContract(governance, {
      initialFields: fields
    })
    deployer.setEnvironment('Governance', result.contractId)
    console.log(`Governace contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
  }
}

export default deployGovernance
