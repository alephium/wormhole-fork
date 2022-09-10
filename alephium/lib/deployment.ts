import {
  BuildDeployContractTx,
  BuildExecuteScriptTx,
  NodeProvider,
  Contract,
  Script,
  Account,
  Project,
  Token,
  CompilerOptions,
  web3
} from "@alephium/web3"
import { PrivateKeyWallet } from "@alephium/web3-wallet"
import path from "path"
import { waitTxConfirmed } from "./utils"
import fs, { promises as fsPromises } from "fs"
import * as cryptojs from 'crypto-js'

export interface Network {
  nodeUrl: string
  mnemonic: string
  deploymentFile: string
  confirmations: number
}

export type NetworkType = "mainnet" | "testnet" | "devnet"

export interface Configuration {
  sourcePath?: string
  artifactPath?: string

  deployScriptsPath: string
  compilerOptions: CompilerOptions

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

  getDeployContractResult(name: string): DeployContractResult
  getRunScriptResult(name: string): RunScriptResult
}

export type DeployFunction = (deployer: Deployer, networkType: NetworkType) => Promise<void>

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

async function createDeployer(
  network: Network,
  deployContractResults: Map<string, DeployContractResult>,
  runScriptResults: Map<string, RunScriptResult>
): Promise<Deployer> {
  const signer = PrivateKeyWallet.FromMnemonic(network.mnemonic)
  const accounts = await signer.getAccounts()
  const account = accounts[0]

  const deployContract = async (contract: Contract, params: DeployContractParams): Promise<DeployContractResult> => {
    // TODO: improve this after migrating to SDK
    const bytecode = contract.buildByteCodeToDeploy(params.initialFields ? params.initialFields : {})
    const codeHash = cryptojs.SHA256(bytecode).toString()
    const previous = deployContractResults.get(contract.name)
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
    if (!needToDeploy) {
      // we have checked in `needToDeployContract`
      return previous!
    }
    const result = await contract.transactionForDeployment(signer, params)
    await signer.submitTransaction(result.unsignedTx, result.txId)
    const confirmed = await waitTxConfirmed(signer.provider, result.txId, network.confirmations)
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
    deployContractResults.set(contract.name, deployContractResult)
    return deployContractResult
  }

  const runScript = async (script: Script, params: RunScriptParams, taskName?: string): Promise<RunScriptResult> => {
    const bytecode = script.buildByteCodeToDeploy(params.initialFields ? params.initialFields : {})
    const codeHash = cryptojs.SHA256(bytecode).toString()
    const key = taskName ? taskName : script.name
    const previous = runScriptResults.get(key)
    const tokens = params.tokens ? getTokenRecord(params.tokens) : undefined
    const needToRun = await needToRunScript(signer.provider, previous, params.attoAlphAmount?.toString(), tokens, codeHash)
    if (needToRun) {
      const result = await script.transactionForDeployment(signer, params)
      await signer.submitTransaction(result.unsignedTx, result.txId)
      const confirmed = await waitTxConfirmed(signer.provider, result.txId, network.confirmations)
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

  const getDeployContractResult = (name: string): DeployContractResult => {
    const result = deployContractResults.get(name)
    if (result === undefined) {
      throw new Error(`Deployment result of contract "${name}" does not exist`)
    }
    return result
  }

  const getRunScriptResult = (name: string): RunScriptResult => {
    const result = runScriptResults.get(name)
    if (result === undefined) {
      throw new Error(`Execution result of script "${name}" does not exist`)
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
async function getDeployScriptFiles(rootPath: string): Promise<string[]> {
  const regex = "^([0-9]+)_.*\\.(ts|js)$"
  const dirents = await fsPromises.readdir(rootPath, { withFileTypes: true })
  const scripts: {filename: string, order: number}[] = []
  for (const f of dirents) {
    if (!f.isFile()) continue
    const result = f.name.match(regex)
    if (result === null) continue
    const order = parseInt(result[1])
    scripts.push({filename: f.name, order: order})
  }
  scripts.sort((a, b) => a.order - b.order)
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].order !== i) {
      throw new Error("Script shoud start with prefix 0, and increased one by one")
    }
  }
  return scripts.map(f => path.join(rootPath, f.filename))
}

export async function deploy(
  configuration: Configuration,
  networkType: NetworkType
) {
  const network = configuration.networks[networkType]
  if (typeof network === 'undefined') {
    throw new Error(`no network ${networkType} config`)
  }

  const scriptsRootPath = configuration.deployScriptsPath ? configuration.deployScriptsPath : "scripts"
  const scriptFiles = await getDeployScriptFiles(path.resolve(scriptsRootPath))
  const funcs: {scriptFilePath: string, func: DeployFunction}[] = []
  for (const scriptFilePath of scriptFiles) {
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

  web3.setCurrentNodeProvider(network.nodeUrl)
  const deployer = await createDeployer(network, deployContractResults, runScriptResults)
  await Project.build(configuration.compilerOptions, configuration.sourcePath, configuration.artifactPath)

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

