import { sleep } from "@alephium/web3";
import { ChainId, ChainName, CHAIN_ID_BSC, CHAIN_ID_ETH, coalesceChainId, createNonce, ethers_contracts, getSignedVAAHash, isEVMChain } from "@alephium/wormhole-sdk";
import { ethers } from "ethers";
import { arrayify, formatUnits } from "ethers/lib/utils";
import {
  createNFTParsedTokenAccount,
  createParsedTokenAccount,
} from "../hooks/useGetSourceParsedTokenAccounts";
import { BSC_RPC_HOST, CLUSTER, ETH_RPC_HOST, getTokenBridgeAddressForChain } from "./consts";
import { Multicall, ContractCallContext } from 'ethereum-multicall';
import axios from "axios"
import i18n from "../i18n";

export const DefaultEVMChainConfirmations = 15
export const EpochDuration = 480000

interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  logoURI: string
}

const TokenListURLs = {
  [CHAIN_ID_ETH]: 'https://tokens-1inch-eth.ipns.dweb.link/',
  [CHAIN_ID_BSC]: 'https://tokens.coingecko.com/binance-smart-chain/all.json'
}

const BackupTokenListURLs = {
  [CHAIN_ID_ETH]: 'https://raw.githubusercontent.com/alephium/wormhole-fork/refs/heads/master/token-list/tokens/eth-token-whitelist.json',
  [CHAIN_ID_BSC]: 'https://raw.githubusercontent.com/alephium/wormhole-fork/refs/heads/master/token-list/tokens/bsc-token-whitelist.json'
}

let _tokenWhiteList: Map<ChainId, TokenInfo[] | undefined> = new Map()

function getTokenListURL(chainId: ChainId): string {
  if (chainId === CHAIN_ID_BSC || chainId === CHAIN_ID_ETH) {
    return TokenListURLs[chainId]
  }
  throw new Error(`Invalid evm chain id: ${chainId}`)
}

async function loadEVMTokenWhitelist(chainId: ChainId): Promise<TokenInfo[]> {
  const whitelist = _tokenWhiteList.get(chainId)
  if (whitelist !== undefined) return whitelist
  const url = getTokenListURL(chainId)
  try {
    const { data: { tokens } } = await axios.get(url)
    _tokenWhiteList.set(chainId, tokens)
    return tokens
  } catch {
    return await loadEVMTokenWhitelistFromBackup(chainId)
  }
}

function getBackupTokenListURL(chainId: ChainId): string {
  if (chainId === CHAIN_ID_BSC || chainId === CHAIN_ID_ETH) {
    return BackupTokenListURLs[chainId]
  }
  throw new Error(`Invalid evm chain id: ${chainId}`)
}

async function loadEVMTokenWhitelistFromBackup(chainId: ChainId): Promise<TokenInfo[]> {
  const url = getBackupTokenListURL(chainId)
  const { data: { tokens } } = await axios.get(url)
  _tokenWhiteList.set(chainId, tokens)
  return tokens
}

async function checkEVMToken(chainId: ChainId, tokenAddress: string) {
  if (CLUSTER !== 'mainnet') return

  const tokenWhitelist = await loadEVMTokenWhitelist(chainId)
  if (tokenWhitelist.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase()) === undefined) {
    throw new Error(`${i18n.t('Token {{ tokenAddress }} does not exist in the token list', { tokenAddress })}: ${getTokenListURL(chainId)}`)
  }
}

async function getEVMTokenLogoAndSymbol(chainId: ChainId, tokenAddress: string) {
  const tokenWhitelist = await loadEVMTokenWhitelist(chainId)
  const tokenInfo = tokenWhitelist.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase())
  if (tokenInfo === undefined) return undefined
  return { logoURI: tokenInfo.logoURI, symbol: tokenInfo.symbol }
}

export async function checkETHToken(tokenAddress: string) {
  await checkEVMToken(CHAIN_ID_ETH, tokenAddress)
}

export async function getETHTokenLogoAndSymbol(tokenAddress: string) {
  return await getEVMTokenLogoAndSymbol(CHAIN_ID_ETH, tokenAddress)
}

export async function checkBSCToken(tokenAddress: string) {
  await checkEVMToken(CHAIN_ID_BSC, tokenAddress)
}

export async function getBSCTokenLogoAndSymbol(tokenAddress: string) {
  return await getEVMTokenLogoAndSymbol(CHAIN_ID_BSC, tokenAddress)
}

//This is a valuable intermediate step to the parsed token account, as the token has metadata information on it.
export async function getEthereumToken(
  tokenAddress: string,
  provider: ethers.providers.Web3Provider
) {
  const token = ethers_contracts.TokenImplementation__factory.connect(tokenAddress, provider);
  return token;
}

export async function evmTokenToParsedTokenAccount(
  chainId: ChainId,
  token: ethers_contracts.TokenImplementation,
  signerAddress: string
) {
  const decimals = await token.decimals();
  const balance = await token.balanceOf(signerAddress);
  const symbol = await token.symbol();
  const name = await token.name();
  const logoURI = (await getEVMTokenLogoAndSymbol(chainId, token.address))?.logoURI
  return createParsedTokenAccount(
    signerAddress,
    token.address,
    balance.toString(),
    decimals,
    Number(formatUnits(balance, decimals)),
    formatUnits(balance, decimals),
    symbol,
    name,
    logoURI
  );
}

//This is a valuable intermediate step to the parsed token account, as the token has metadata information on it.
export async function getEthereumNFT(
  tokenAddress: string,
  provider: ethers.providers.Web3Provider
) {
  const token = ethers_contracts.NFTImplementation__factory.connect(tokenAddress, provider);
  return token;
}

export async function isNFT(token: ethers_contracts.NFTImplementation) {
  const erc721 = "0x80ac58cd";
  const erc721metadata = "0x5b5e139f";
  const supportsErc721 = await token.supportsInterface(arrayify(erc721));
  const supportsErc721Metadata = await token.supportsInterface(
    arrayify(erc721metadata)
  );
  return supportsErc721 && supportsErc721Metadata;
}

export async function ethNFTToNFTParsedTokenAccount(
  token: ethers_contracts.NFTImplementation,
  tokenId: string,
  signerAddress: string
) {
  const decimals = 0;
  const balance = (await token.ownerOf(tokenId)) === signerAddress ? 1 : 0;
  const symbol = await token.symbol();
  const name = await token.name();
  const uri = await token.tokenURI(tokenId);
  return createNFTParsedTokenAccount(
    signerAddress,
    token.address,
    balance.toString(),
    decimals,
    Number(formatUnits(balance, decimals)),
    formatUnits(balance, decimals),
    tokenId,
    symbol,
    name,
    uri
  );
}

export function isValidEthereumAddress(address: string) {
  return ethers.utils.isAddress(address);
}

function checkEVMChainId(chainId: ChainId) {
  if (!isEVMChain(chainId)) {
    throw new Error(`invalid chain id ${chainId}, expected an evm chain`)
  }
}

export async function getEVMCurrentBlockNumber(provider: ethers.providers.Provider, chainId: ChainId): Promise<number> {
  checkEVMChainId(chainId)
  return chainId === CHAIN_ID_ETH && CLUSTER !== 'devnet'
    ? (await provider.getBlock("finalized")).number
    : await provider.getBlockNumber()
}

export function isEVMTxConfirmed(chainId: ChainId, txBlock: number, currentBlock: number): boolean {
  checkEVMChainId(chainId)
  return chainId === CHAIN_ID_ETH
    ? currentBlock >= txBlock
    : currentBlock >= (txBlock + DefaultEVMChainConfirmations)
}

export async function waitEVMTxConfirmed(provider: ethers.providers.Provider, txBlockNumber: number, chainId: ChainId) {
  checkEVMChainId(chainId)
  await _waitEVMTxConfirmed(provider, txBlockNumber, chainId)
}

async function _waitEVMTxConfirmed(
  provider: ethers.providers.Provider,
  txBlockNumber: number,
  chainId: ChainId,
  lastBlockNumber: number | undefined = undefined,
  lastBlockUpdatedTs: number = Date.now(),
) {
  const currentBlockNumber = await getEVMCurrentBlockNumber(provider, chainId)
  if (isEVMTxConfirmed(chainId, txBlockNumber, currentBlockNumber)) {
    return
  }
  await sleep(3000)
  const now = Date.now()
  const [evmProvider, timestamp] = currentBlockNumber === lastBlockNumber && (now - lastBlockUpdatedTs > EpochDuration)
    ? [getEvmJsonRpcProvider(chainId) ?? provider, now]
    : currentBlockNumber !== lastBlockNumber
    ? [provider, now]
    : [provider, lastBlockUpdatedTs]
  await _waitEVMTxConfirmed(evmProvider, txBlockNumber, chainId, currentBlockNumber, timestamp)
}

export function getEvmJsonRpcProvider(chainId: ChainId): ethers.providers.Provider | undefined {
  checkEVMChainId(chainId)
  return chainId === CHAIN_ID_ETH
    ? new ethers.providers.JsonRpcProvider(ETH_RPC_HOST)
    : chainId === CHAIN_ID_BSC
    ? new ethers.providers.JsonRpcProvider(BSC_RPC_HOST)
    : undefined
}

export async function getIsTxsCompletedEvm(chainId: ChainId, provider: ethers.providers.Provider, signedVaas: string[]): Promise<boolean[]> {
  const tokenBridgeAddress = getTokenBridgeAddressForChain(chainId)
  const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });
  const abi = [{ name: 'isTransferCompleted', type: 'function', stateMutability: 'view', inputs: [{ name: 'hash', type: 'bytes32' }], outputs: [{ type: 'bool' }] }]
  const contractCallContext: ContractCallContext[] = signedVaas.map((signedVaa, index) => ({
    reference: `call-${index}`,
    contractAddress: tokenBridgeAddress,
    abi,
    calls: [{ reference: 'getIsTransferCompleted', methodName: 'isTransferCompleted', methodParameters: [getSignedVAAHash(Buffer.from(signedVaa, 'hex'))] }]
  }))
  const result = await multicall.call(contractCallContext)

  const results = signedVaas.map((_, index) => {
    const callResult = result.results[`call-${index}`].callsReturnContext
    if (callResult.length === 0 || !callResult[0].success) return false
    return callResult[0].returnValues[0] as boolean
  })
  return results
}

// TODO: remove these functions to SDK
export async function transferFromEthWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: ethers.PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.transferTokens(
    tokenAddress,
    amount,
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    overrides
  );
}

export async function transferFromEthNativeWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainId,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: ethers.PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.wrapAndTransferETH(
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    {
      ...overrides,
      value: amount,
    }
  );
}

export async function attestFromEthWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  overrides: ethers.PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.attestToken(tokenAddress, createNonce(), overrides);
}

export async function redeemOnEthWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: ethers.Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.completeTransfer(signedVAA, overrides);
}

export async function redeemOnEthNativeWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: ethers.Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.completeTransferAndUnwrapETH(signedVAA, overrides);
}

export async function createWrappedOnEthWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: ethers.Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.createWrapped(signedVAA, overrides);
}

export async function updateWrappedOnEthWithoutWait(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: ethers.Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.updateWrapped(signedVAA, overrides);
}

export async function approveEthWithoutWait(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  overrides: ethers.Overrides & { from?: string | Promise<string> } = {}
) {
  const token = ethers_contracts.TokenImplementation__factory.connect(tokenAddress, signer);
  return await token.approve(tokenBridgeAddress, amount, overrides)
}
