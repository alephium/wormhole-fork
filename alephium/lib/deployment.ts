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
  Project
} from "@alephium/web3"
import { getWalletFromMnemonic } from "@alephium/sdk"
import path from "path"
import { ec as EC } from 'elliptic'
import { waitTxConfirmed } from "./utils"

export interface Network {
  providerUrl: string
  mnemonic: string
  scripts: string[] // script file path, execute by order
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

export interface Deployer {
  provider: NodeProvider
  account: Account

  deployContract(contract: Contract, params: DeployContractParams): Promise<DeployContractResult>
  runScript(script: Script, params: RunScriptParams): Promise<RunScriptResult>
  setEnvironment(key: string, value: string): void
  getEnvironment(key: string): string
}

export type DeployFunction = (deployer: Deployer, networkType: NetworkType) => Promise<void>

class PrivateKeySigner extends SignerWithNodeProvider {
  private static ec = new EC('secp256k1')

  private readonly privateKey: string
  private readonly publicKey: string
  private readonly address: string
  private readonly group: number

  constructor(provider: NodeProvider, privateKey: string, alwaysSubmitTx = true) {
    super(provider, alwaysSubmitTx)
    this.privateKey = privateKey
    this.publicKey = publicKeyFromPrivateKey(privateKey)
    this.address = addressFromPublicKey(this.publicKey)
    this.group = groupOfAddress(this.address)
  }

  static from(mnemonic: string, providerUrl: string): PrivateKeySigner {
    const wallet = getWalletFromMnemonic(mnemonic)
    const provider = new NodeProvider(providerUrl)
    return new PrivateKeySigner(provider, wallet.privateKey)
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

function createDeployer(network: Network): Deployer {
  const signer = PrivateKeySigner.from(network.mnemonic, network.providerUrl)
  const environment = new Map<string, string>()
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
    environment.set(key, value)
  }

  const getEnvironment = (key: string) => {
    const value = environment.get(key)
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

// TODO: continue executing from the last failed step
export async function deploy(
  configuration: Configuration,
  networkType: NetworkType
) {
  const network = configuration.networks[networkType]
  if (typeof network === 'undefined') {
    throw new Error(`no network ${networkType} config`)
  }

  const funcs: {scriptFilePath: string, func: DeployFunction}[] = []
  if (typeof network.scripts === 'undefined' || network.scripts.length === 0) {
    throw new Error("no deploy script")
  }

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

  const deployer = createDeployer(network)
  if (typeof network.environments !== 'undefined') {
    for (const key in network.environments) {
      deployer.setEnvironment(key, network.environments[key])
    }
  }

  await Project.build(deployer.provider, configuration.sourcePath, configuration.artifactPath)

  for (const f of funcs) {
    try {
      await f.func(deployer, networkType)
    } catch (error) {
      throw new Error(`failed to execute deploy script, filepath: ${f.scriptFilePath}, error: ${error}`)
    }
  }

  console.log("Deployment script execution completed")
}
