import {
  BuildDeployContractTx,
  BuildExecuteScriptTx,
  NodeProvider,
  Contract,
  Script,
  SignerWithNodeProvider,
  groupOfAddress,
  Account,
  publicKeyFromPrivateKey,
  addressFromPublicKey,
  signatureEncode,
  Project,
  setCurrentNodeProvider
} from "@alephium/web3"
import { getWalletFromMnemonic } from "@alephium/sdk"
import path from "path"
import { ec as EC } from 'elliptic'
import { waitTxConfirmed } from "./utils"
import fs, { promises as fsPromises } from "fs"

export interface Network {
  nodeUrl: string
  mnemonic: string
  scripts: string[] // script file path, execute by order
  deploymentFile: string
}

export type NetworkType = "mainnet" | "testnet" | "devnet"

export interface Configuration {
  sourcePath?: string
  artifactPath?: string

  networks: Record<NetworkType, Network>
}

type DeployContractParams = Omit<BuildDeployContractTx, 'signerAddress'>

export interface DeployContractResult {
  fromGroup: number
  toGroup: number
  txId: string
  blockHash: string
  contractId: string
  contractAddress: string
}

type RunScriptParams = Omit<BuildExecuteScriptTx, 'signerAddress'>

export interface RunScriptResult {
  fromGroup: number
  toGroup: number
  txId: string
  blockHash: string
}

class Deployments {
  lastFailedStep: number
  deployContractResults: Map<string, DeployContractResult>
  runScriptResults: Map<string, RunScriptResult>

  constructor(
    lastFailedStep: number,
    deployContractResults: Map<string, DeployContractResult>,
    runScriptResults: Map<string, RunScriptResult>
  ) {
    this.lastFailedStep = lastFailedStep
    this.deployContractResults = deployContractResults
    this.runScriptResults = runScriptResults
  }

  async saveToFile(filepath: string): Promise<void> {
    const dirpath = path.dirname(filepath)
    if (!fs.existsSync(dirpath)) {
      fs.mkdirSync(dirpath, {recursive: true})
    }
    const json = {
      'lastFailedStep': this.lastFailedStep,
      'deployContractResults': Object.fromEntries(this.deployContractResults),
      'runScriptResults': Object.fromEntries(this.runScriptResults)
    }
    const content = JSON.stringify(json, null, 2)
    return fsPromises.writeFile(filepath, content)
  }

  static async from(filepath: string): Promise<Deployments | undefined> {
    if (!fs.existsSync(filepath)) {
      return undefined
    }
    const content = await fsPromises.readFile(filepath)
    const json = JSON.parse(content.toString())
    const lastFailedStep = json.lastFailedStep as number
    const deployContractResults = new Map(Object.entries<DeployContractResult>(json.deployContractResults))
    const runScriptResults = new Map(Object.entries<RunScriptResult>(json.runScriptResults))
    return new Deployments(lastFailedStep, deployContractResults, runScriptResults)
  }
}

export interface Deployer {
  provider: NodeProvider
  account: Account

  deployContract(contract: Contract, params: DeployContractParams): Promise<DeployContractResult>
  runScript(script: Script, params: RunScriptParams): Promise<RunScriptResult>

  getDeployContractResult(typeId: string): DeployContractResult
  getRunScriptResult(typeId: string): RunScriptResult
}

export type DeployFunction = (deployer: Deployer, networkType: NetworkType) => Promise<void>

export class PrivateKeySigner extends SignerWithNodeProvider {
  private static ec = new EC('secp256k1')

  private readonly privateKey: string
  private readonly publicKey: string
  private readonly address: string
  private readonly group: number

  constructor(privateKey: string, alwaysSubmitTx = true) {
    super(alwaysSubmitTx)
    this.privateKey = privateKey
    this.publicKey = publicKeyFromPrivateKey(privateKey)
    this.address = addressFromPublicKey(this.publicKey)
    this.group = groupOfAddress(this.address)
  }

  static from(mnemonic: string): PrivateKeySigner {
    const wallet = getWalletFromMnemonic(mnemonic)
    return new PrivateKeySigner(wallet.privateKey)
  }

  getAccountSync(): Account {
    return { address: this.address, publicKey: this.publicKey, group: this.group }
  }

  async getAccounts(): Promise<Account[]> {
    return [this.getAccountSync()]
  }

  async signRaw(signerAddress: string, hexString: string): Promise<string> {
    if (signerAddress !== this.address) {
      throw Error('Unmatched signer address')
    }

    const key = PrivateKeySigner.ec.keyFromPrivate(this.privateKey)
    const signature = key.sign(hexString)
    return signatureEncode(signature)
  }
}

function createDeployer(
  network: Network,
  deployContractResults: Map<string, DeployContractResult>,
  runScriptResults: Map<string, RunScriptResult>
): Deployer {
  const signer = PrivateKeySigner.from(network.mnemonic)
  const account = signer.getAccountSync()

  const deployContract = async (contract: Contract, params: DeployContractParams): Promise<DeployContractResult> => {
    const result = await contract.transactionForDeployment(signer, params)
    await signer.submitTransaction(result.unsignedTx, result.txId)
    const confirmed = await waitTxConfirmed(signer.provider, result.txId)
    const deployContractResult = {
      fromGroup: result.fromGroup,
      toGroup: result.toGroup,
      txId: result.txId,
      blockHash: confirmed.blockHash,
      contractId: result.contractId,
      contractAddress: result.contractAddress
    }
    deployContractResults.set(contract.typeId, deployContractResult)
    return deployContractResult
  }

  const runScript = async (script: Script, params: RunScriptParams): Promise<RunScriptResult> => {
    const result = await script.transactionForDeployment(signer, params)
    await signer.submitTransaction(result.unsignedTx, result.txId)
    const confirmed = await waitTxConfirmed(signer.provider, result.txId)
    const runScriptResult = {
      fromGroup: result.fromGroup,
      toGroup: result.toGroup,
      txId: result.txId,
      blockHash: confirmed.blockHash
    }
    runScriptResults.set(script.typeId, runScriptResult)
    return runScriptResult
  }

  const getDeployContractResult = (typeId: string): DeployContractResult => {
    const result = deployContractResults.get(typeId)
    if (result === undefined) {
      throw new Error(`Contract ${typeId} deployment result does not exist`)
    }
    return result
  }

  const getRunScriptResult = (typeId: string): RunScriptResult => {
    const result = runScriptResults.get(typeId)
    if (result === undefined) {
      throw new Error(`Script ${typeId} execute result does not exist`)
    }
    return result
  }

  return {
    provider: signer.provider,
    account: account,
    deployContract: deployContract,
    runScript: runScript,
    getDeployContractResult: getDeployContractResult,
    getRunScriptResult: getRunScriptResult
  }
}

async function saveDeploymentsToFile(
  lastFailedStep: number,
  deployContractResults: Map<string, DeployContractResult>,
  runScriptResults: Map<string, RunScriptResult>,
  filepath: string
) {
  const deployments = new Deployments(lastFailedStep, deployContractResults, runScriptResults)
  await deployments.saveToFile(filepath)
}

export async function deploy(
  configuration: Configuration,
  networkType: NetworkType
) {
  const network = configuration.networks[networkType]
  if (typeof network === 'undefined') {
    throw new Error(`no network ${networkType} config`)
  }

  if (typeof network.scripts === 'undefined' || network.scripts.length === 0) {
    throw new Error("no deploy script")
  }

  const funcs: {scriptFilePath: string, func: DeployFunction}[] = []
  for (const filepath of network.scripts) {
    const scriptFilePath = path.resolve(filepath);
    let func: DeployFunction;
    try {
      func = require(scriptFilePath);
      if ((func as any).default) {
        func = (func as any).default as DeployFunction;
      }
      funcs.push({scriptFilePath, func})
    } catch (error) {
      throw new Error(`failed to load deploy script, filepath: ${scriptFilePath}, error: ${error}`)
    }
  }

  let lastFailedStep = 0
  let deployContractResults = new Map<string, DeployContractResult>()
  let runScriptResults = new Map<string, RunScriptResult>()
  const deployments = await Deployments.from(network.deploymentFile)
  if (typeof deployments !== 'undefined') {
    lastFailedStep = deployments.lastFailedStep
    deployContractResults = deployments.deployContractResults
    runScriptResults = deployments.runScriptResults
  }

  setCurrentNodeProvider(network.nodeUrl)
  const deployer = createDeployer(network, deployContractResults, runScriptResults)
  await Project.build(configuration.sourcePath, configuration.artifactPath)

  const remainScripts = funcs.slice(lastFailedStep)
  for (const script of remainScripts) {
    try {
      await script.func(deployer, networkType)
      lastFailedStep += 1
    } catch (error) {
      await saveDeploymentsToFile(lastFailedStep, deployContractResults, runScriptResults, network.deploymentFile)
      throw new Error(`failed to execute deploy script, filepath: ${script.scriptFilePath}, error: ${error}`)
    }
  }

  if (remainScripts.length > 0) {
    await saveDeploymentsToFile(lastFailedStep, deployContractResults, runScriptResults, network.deploymentFile)
  }
  console.log("Deployment script execution completed")
}
