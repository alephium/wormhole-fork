import {
  BuildDeployContractTx,
  BuildExecuteScriptTx,
  BuildScriptTxResult,
  DeployContractTransaction,
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
  environments?: Record<string, string>
}

export type NetworkType = "mainnet" | "testnet" | "devnet"

export interface Configuration {
  sourcePath?: string
  artifactPath?: string

  networks: Record<NetworkType, Network>
}

type DeployContractParams = Omit<BuildDeployContractTx, 'signerAddress'>

export interface DeployContractResult extends DeployContractTransaction {
  blockHash: string
}

type RunScriptParams = Omit<BuildExecuteScriptTx, 'signerAddress'>

export interface RunScriptResult extends BuildScriptTxResult {
  blockHash: string
}

class Deployments {
  lastFailedStep: number
  environments: Map<string, string>

  constructor(lastFailedStep: number, environments: Map<string, string>) {
    this.lastFailedStep = lastFailedStep
    this.environments = environments
  }

  async saveToFile(filepath: string): Promise<void> {
    const dirpath = path.dirname(filepath)
    if (!fs.existsSync(dirpath)) {
      fs.mkdirSync(dirpath, {recursive: true})
    }
    const json = {
      'lastFailedStep': this.lastFailedStep,
      'environments': Object.fromEntries(this.environments)
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
    const environments = new Map(Object.entries<string>(json.environments))
    return new Deployments(lastFailedStep, environments)
  }
}

export interface Deployer {
  provider: NodeProvider
  account: Account

  deployContract(contract: Contract, params: DeployContractParams): Promise<DeployContractResult>
  runScript(script: Script, params: RunScriptParams): Promise<RunScriptResult>
  setEnvironment(key: string, value: string): void
  getEnvironment(key: string): string
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

function createDeployer(network: Network, environments: Map<string, string>): Deployer {
  const signer = PrivateKeySigner.from(network.mnemonic)
  const account = signer.getAccountSync()

  const deployContract = async (contract: Contract, params: DeployContractParams): Promise<DeployContractResult> => {
    const result = await contract.transactionForDeployment(signer, params)
    await signer.submitTransaction(result.unsignedTx, result.txId)
    const confirmed = await waitTxConfirmed(signer.provider, result.txId)
    return {...result, blockHash: confirmed.blockHash}
  }

  const runScript = async (script: Script, params: RunScriptParams): Promise<RunScriptResult> => {
    const result = await script.transactionForDeployment(signer, params)
    await signer.submitTransaction(result.unsignedTx, result.txId)
    const confirmed = await waitTxConfirmed(signer.provider, result.txId)
    return {...result, blockHash: confirmed.blockHash}
  }

  const setEnvironment = (key: string, value: string) => {
    environments.set(key, value)
  }

  const getEnvironment = (key: string) => {
    const value = environments.get(key)
    if (typeof value === 'undefined') {
      throw new Error(`${key} does not exist`)
    }
    return value
  }

  return {
    provider: signer.provider,
    account: account,
    deployContract: deployContract,
    runScript: runScript,
    setEnvironment: setEnvironment,
    getEnvironment: getEnvironment
  }
}

async function saveDeploymentsToFile(
  lastFailedStep: number,
  environments: Map<string, string>,
  filepath: string
) {
  const deployments = new Deployments(lastFailedStep, environments)
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

  setCurrentNodeProvider(network.nodeUrl)
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
  let environments = new Map<string, string>()
  const deployments = await Deployments.from(network.deploymentFile)
  if (typeof deployments !== 'undefined') {
    lastFailedStep = deployments.lastFailedStep
    environments = deployments.environments
  }

  const deployer = createDeployer(network, environments)
  if (typeof network.environments !== 'undefined') {
    for (const key in network.environments) {
      deployer.setEnvironment(key, network.environments[key])
    }
  }

  await Project.build(configuration.sourcePath, configuration.artifactPath)

  const remainScripts = funcs.slice(lastFailedStep)
  for (const script of remainScripts) {
    try {
      await script.func(deployer, networkType)
      lastFailedStep += 1
    } catch (error) {
      await saveDeploymentsToFile(lastFailedStep, environments, network.deploymentFile)
      throw new Error(`failed to execute deploy script, filepath: ${script.scriptFilePath}, error: ${error}`)
    }
  }

  if (remainScripts.length > 0) {
    await saveDeploymentsToFile(lastFailedStep, environments, network.deploymentFile)
  }
  console.log("Deployment script execution completed")
}
