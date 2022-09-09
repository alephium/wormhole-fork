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
  setCurrentNodeProvider,
  Token
} from "@alephium/web3"
import { getWalletFromMnemonic } from "@alephium/sdk"
import path from "path"
import { ec as EC } from 'elliptic'
import { waitTxConfirmed } from "./utils"
import fs, { promises as fsPromises } from "fs"
import * as cryptojs from 'crypto-js'

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

export interface ExecutionResult {
  fromGroup: number
  toGroup: number
  txId: string
  blockHash: string
  codeHash: string
  attoAlphAmount?: string
  tokens?: Record<string, string>
}

export interface DeployContractResult extends ExecutionResult {
  contractId: string
  contractAddress: string
  issueTokenAmount?: string
}

type RunScriptParams = Omit<BuildExecuteScriptTx, 'signerAddress'>

export interface RunScriptResult extends ExecutionResult {
}

class Deployments {
  deployContractResults: Map<string, DeployContractResult>
  runScriptResults: Map<string, RunScriptResult>

  constructor(
    deployContractResults: Map<string, DeployContractResult>,
    runScriptResults: Map<string, RunScriptResult>
  ) {
    this.deployContractResults = deployContractResults
    this.runScriptResults = runScriptResults
  }

  async saveToFile(filepath: string): Promise<void> {
    const dirpath = path.dirname(filepath)
    if (!fs.existsSync(dirpath)) {
      fs.mkdirSync(dirpath, {recursive: true})
    }
    const json = {
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
    const deployContractResults = new Map(Object.entries<DeployContractResult>(json.deployContractResults))
    const runScriptResults = new Map(Object.entries<RunScriptResult>(json.runScriptResults))
    return new Deployments(deployContractResults, runScriptResults)
  }
}

export interface Deployer {
  provider: NodeProvider
  account: Account

  deployContract(contract: Contract, params: DeployContractParams): Promise<DeployContractResult>
  runScript(script: Script, params: RunScriptParams, taskName?: string): Promise<RunScriptResult>

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

async function isTxExists(provider: NodeProvider, txId: string): Promise<boolean> {
  const txStatus = await provider.transactions.getTransactionsStatus({txId: txId})
  return txStatus.type !== "TxNotFound"
}

function recordEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false
    }
  }
  return true
}

async function needToRetry(
  provider: NodeProvider,
  previous: ExecutionResult | undefined,
  attoAlphAmount: string | undefined,
  tokens: Record<string, string> | undefined,
  codeHash: string
): Promise<boolean> {
  if (previous === undefined || previous.codeHash !== codeHash) {
    return true
  }
  const txExists = await isTxExists(provider, previous.txId)
  if (!txExists) {
    return true
  }
  const currentTokens = tokens ? tokens : {}
  const previousTokens = previous.tokens ? previous.tokens : {}
  const sameWithPrevious =
    (attoAlphAmount === previous.attoAlphAmount) &&
    (recordEqual(currentTokens, previousTokens))
  return !sameWithPrevious
}

async function needToDeployContract(
  provider: NodeProvider,
  previous: DeployContractResult | undefined,
  attoAlphAmount: string | undefined,
  tokens: Record<string, string> | undefined,
  issueTokenAmount: string | undefined,
  codeHash: string
): Promise<boolean> {
  const retry = await needToRetry(provider, previous, attoAlphAmount, tokens, codeHash)
  if (retry) {
    return true
  }
  // previous !== undefined if retry is false
  return previous!.issueTokenAmount !== issueTokenAmount
}

async function needToRunScript(
  provider: NodeProvider,
  previous: RunScriptResult | undefined,
  attoAlphAmount: string | undefined,
  tokens: Record<string, string> | undefined,
  codeHash: string
): Promise<boolean> {
  return needToRetry(provider, previous, attoAlphAmount, tokens, codeHash)
}

function getTokenRecord(tokens: Token[]): Record<string, string> {
  return tokens.reduce<Record<string, string>>((acc, token) => {
    acc[token.id] = token.amount.toString()
    return acc
  }, {})
}

function createDeployer(
  network: Network,
  deployContractResults: Map<string, DeployContractResult>,
  runScriptResults: Map<string, RunScriptResult>
): Deployer {
  const signer = PrivateKeySigner.from(network.mnemonic)
  const account = signer.getAccountSync()

  const deployContract = async (contract: Contract, params: DeployContractParams): Promise<DeployContractResult> => {
    // TODO: improve this after migrating to SDK
    const bytecode = contract.buildByteCodeToDeploy(params.initialFields ? params.initialFields : {})
    const codeHash = cryptojs.SHA256(bytecode).toString()
    const previous = deployContractResults.get(contract.typeId)
    const tokens = params.initialTokenAmounts ? getTokenRecord(params.initialTokenAmounts) : undefined
    const issueTokenAmount: string | undefined = params.issueTokenAmount?.toString()
    const needToDeploy = await needToDeployContract(
      signer.provider,
      previous,
      params.initialAttoAlphAmount,
      tokens,
      issueTokenAmount,
      codeHash
    )
    if (needToDeploy) {
      const result = await contract.transactionForDeployment(signer, params)
      await signer.submitTransaction(result.unsignedTx, result.txId)
      const confirmed = await waitTxConfirmed(signer.provider, result.txId)
      const deployContractResult: DeployContractResult = {
        fromGroup: result.fromGroup,
        toGroup: result.toGroup,
        txId: result.txId,
        blockHash: confirmed.blockHash,
        contractId: result.contractId,
        contractAddress: result.contractAddress,
        codeHash: codeHash,
        attoAlphAmount: params.initialAttoAlphAmount,
        tokens: tokens,
        issueTokenAmount: issueTokenAmount
      }
      deployContractResults.set(contract.typeId, deployContractResult)
      return deployContractResult
    }
    // we have checked in `needToDeployContract`
    return previous!
  }

  const runScript = async (script: Script, params: RunScriptParams, taskName?: string): Promise<RunScriptResult> => {
    const bytecode = script.buildByteCodeToDeploy(params.initialFields ? params.initialFields : {})
    const codeHash = cryptojs.SHA256(bytecode).toString()
    const key = taskName ? taskName : script.typeId
    const previous = runScriptResults.get(key)
    const tokens = params.tokens ? getTokenRecord(params.tokens) : undefined
    const needToRun = await needToRunScript(signer.provider, previous, params.attoAlphAmount?.toString(), tokens, codeHash)
    if (needToRun) {
      const result = await script.transactionForDeployment(signer, params)
      await signer.submitTransaction(result.unsignedTx, result.txId)
      const confirmed = await waitTxConfirmed(signer.provider, result.txId)
      const runScriptResult: RunScriptResult = {
        fromGroup: result.fromGroup,
        toGroup: result.toGroup,
        txId: result.txId,
        blockHash: confirmed.blockHash,
        codeHash: codeHash,
        attoAlphAmount: params.attoAlphAmount?.toString(),
        tokens: tokens
      }
      runScriptResults.set(key, runScriptResult)
      return runScriptResult
    }
    // we have checked in `needToRunScript`
    return previous!
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
  deployContractResults: Map<string, DeployContractResult>,
  runScriptResults: Map<string, RunScriptResult>,
  filepath: string
) {
  const deployments = new Deployments(deployContractResults, runScriptResults)
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
    try {
      const content = require(scriptFilePath)
      if (content.default) {
        funcs.push({
          scriptFilePath: scriptFilePath,
          func: content.default as DeployFunction
        })
      } else {
        throw new Error(`no default deploy function exported from ${scriptFilePath}`)
      }
    } catch (error) {
      throw new Error(`failed to load deploy script, filepath: ${scriptFilePath}, error: ${error}`)
    }
  }

  let deployContractResults = new Map<string, DeployContractResult>()
  let runScriptResults = new Map<string, RunScriptResult>()
  const deployments = await Deployments.from(network.deploymentFile)
  if (typeof deployments !== 'undefined') {
    deployContractResults = deployments.deployContractResults
    runScriptResults = deployments.runScriptResults
  }

  setCurrentNodeProvider(network.nodeUrl)
  const deployer = createDeployer(network, deployContractResults, runScriptResults)
  await Project.build(configuration.sourcePath, configuration.artifactPath)

  for (const script of funcs) {
    try {
      await script.func(deployer, networkType)
    } catch (error) {
      await saveDeploymentsToFile(deployContractResults, runScriptResults, network.deploymentFile)
      throw new Error(`failed to execute deploy script, filepath: ${script.scriptFilePath}, error: ${error}`)
    }
  }

  await saveDeploymentsToFile(deployContractResults, runScriptResults, network.deploymentFile)
  console.log("Deployment script execution completed")
}
