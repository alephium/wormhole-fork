import { execSync } from 'child_process'
import { AlephiumBridgeChain } from '../alph'
import { assert, getBridgeChains, normalizeTokenId, randomBigInt } from '../utils'
import { TransferTokenTest } from './transfer_token'
import { BridgeChain } from '../bridge_chain'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'

async function attestInvalidToken(alph: AlephiumBridgeChain) {
  const testTokenInfo = await alph.getLocalTokenInfo(alph.testTokenId)
  const testTokenInfos = [
    { ...testTokenInfo, decimals: testTokenInfo.decimals + 1 },
    { ...testTokenInfo, symbol: testTokenInfo.symbol + 'XX' },
    { ...testTokenInfo, name: testTokenInfo.name + 'XX' }
  ]

  const test = async (info: any) => {
    console.log(`trying to attest invalid token: ${JSON.stringify(info)}`)
    try {
      await alph.attestWithTokenInfo(alph.testTokenId, info.decimals, info.symbol, info.name)
    } catch (error) {
      console.log(`failed to attest invalid token, error: ${error}`)
      return
    }
    assert(false)
  }

  for (let i = 0; i < testTokenInfos.length; i++) {
    await test(testTokenInfos[i])
  }
}

async function checkWrappedToken(sourceChain: BridgeChain, targetChain: BridgeChain, tokenId: string) {
  const sourceTokenInfo = await sourceChain.getLocalTokenInfo(tokenId)
  const wrappedTokenId = await targetChain.getWrappedTokenId(sourceChain.chainId, normalizeTokenId(tokenId))
  const wrappedTokenInfo = await targetChain.getLocalTokenInfo(wrappedTokenId)
  assert(wrappedTokenInfo.symbol === sourceTokenInfo.symbol)
  assert(wrappedTokenInfo.name === `${sourceTokenInfo.name} (Wormhole)`)
  assert(wrappedTokenInfo.decimals === sourceTokenInfo.decimals)
}

async function attestTokenFromAlph(alph: AlephiumBridgeChain, targetChains: BridgeChain[]) {
  for (const tokenId of [alph.testTokenId, alph.wrappedNativeTokenId]) {
    const tokenInfo = await alph.getLocalTokenInfo(tokenId)
    const signedVaa = await alph.attestWithTokenInfo(tokenId, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)
    for (const targetChain of targetChains) {
      await targetChain.createWrapped(signedVaa)
      await checkWrappedToken(alph, targetChain, tokenId)
    }
  }
}

async function attestToken(from: BridgeChain, targetChains: BridgeChain[]) {
  for (const tokenId of [from.testTokenId, from.wrappedNativeTokenId]) {
    const signedVaa = await from.attestToken(tokenId)
    for (const targetChain of targetChains) {
      await targetChain.createWrapped(signedVaa)
      await checkWrappedToken(from, targetChain, tokenId)
    }
  }
}

async function attestTokens(alph: AlephiumBridgeChain, eth: BridgeChain, bsc: BridgeChain) {
  await attestTokenFromAlph(alph, [eth, bsc])
  await attestToken(eth, [alph, bsc])
  await attestToken(bsc, [eth, alph])
}

class ChainPair {
  static multiSigTransferTimes = 10

  chainA: BridgeChain
  chainB: BridgeChain

  constructor(chainA: BridgeChain, chainB: BridgeChain) {
    this.chainA = chainA
    this.chainB = chainB
  }

  async test(transferTimes: number): Promise<void> {
    const aToB = new TransferTokenTest(this.chainA, this.chainB)
    const bToA = new TransferTokenTest(this.chainB, this.chainA)

    const transferTestTokenFromAlphToEvmChain = async () => {
      const remain = await this.chainA.getTokenBalance(this.chainA.testTokenId)
      const amount = randomBigInt(remain, this.chainA.normalizeTransferAmount)
      await aToB.transferTestToken(amount)
      const normalizedTokenId = normalizeTokenId(this.chainA.testTokenId)
      assert((await this.chainB.getWrappedTokenTotalSupply(this.chainA.chainId, normalizedTokenId)) === amount)
      await bToA.transferWrappedTestToken(amount)
      assert((await this.chainB.getWrappedTokenTotalSupply(this.chainA.chainId, normalizedTokenId)) === 0n)
    }

    const transferALPHFromAlphToEvmChain = async () => {
      const remain = await this.chainA.getNativeTokenBalance()
      // minus 1 coin for tx fee
      const amount = randomBigInt(remain - this.chainA.oneCoin, this.chainA.normalizeTransferAmount)
      // we will add the `messageFee` to the `amount` in the `transferNativeToken` function
      await aToB.transferNativeToken(amount)
      const normalizedTokenId = normalizeTokenId(this.chainA.wrappedNativeTokenId)
      assert((await this.chainB.getWrappedTokenTotalSupply(this.chainA.chainId, normalizedTokenId)) === amount)
      await bToA.transferWrappedNativeToken(amount)
      assert((await this.chainB.getWrappedTokenTotalSupply(this.chainA.chainId, normalizedTokenId)) === 0n)
    }

    const transferTestTokenFromEvmChainToAlph = async () => {
      const remain = await this.chainB.getTokenBalance(this.chainB.testTokenId)
      const amount = randomBigInt(remain, this.chainB.normalizeTransferAmount)
      const normalizedTokenId = normalizeTokenId(this.chainB.testTokenId)
      await bToA.transferTestToken(amount)
      assert((await this.chainA.getWrappedTokenTotalSupply(this.chainB.chainId, normalizedTokenId)) === amount)
      await aToB.transferWrappedTestToken(amount)
      assert((await this.chainA.getWrappedTokenTotalSupply(this.chainB.chainId, normalizedTokenId)) === 0n)
    }

    const transferWrappedNativeFromEvmChainToAlph = async () => {
      const remain = await this.chainB.getNativeTokenBalance()
      // minus 1 coin for tx fee
      const amount = randomBigInt(remain - this.chainB.oneCoin, this.chainB.normalizeTransferAmount)
      const normalizedNativeTokenId = normalizeTokenId(this.chainB.wrappedNativeTokenId)
      // we will add the `messageFee` to the `amount` in the `transferNativeToken` function
      await bToA.transferNativeToken(amount)
      assert((await this.chainA.getWrappedTokenTotalSupply(this.chainB.chainId, normalizedNativeTokenId)) === amount)
      await aToB.transferWrappedNativeToken(amount)
      assert((await this.chainA.getWrappedTokenTotalSupply(this.chainB.chainId, normalizedNativeTokenId)) === 0n)
    }

    const transfers = [
      transferTestTokenFromAlphToEvmChain,
      transferALPHFromAlphToEvmChain,
      transferTestTokenFromEvmChainToAlph,
      transferWrappedNativeFromEvmChainToAlph
    ]

    for (let i = 0; i < transferTimes; i++) {
      const index = Math.floor(Math.random() * 4)
      const func = transfers[index]
      try {
        await func()
      } catch (error) {
        console.log(`ERROR: ${error}`)
        const alphErrorLog = execSync('cat ~/.alephium-dev/logs/alephium-errors.log')
        console.log(alphErrorLog.toString())
        process.exit(-1)
      }
    }

    if (this.chainA.chainId === CHAIN_ID_ALEPHIUM) {
      await bToA.transferToMultiSigAddress(ChainPair.multiSigTransferTimes)
    }
  }
}

async function test() {
  const chains = await getBridgeChains()
  const alph = chains.alph
  const eth = chains.eth
  const bsc = chains.bsc

  console.log('================== attest invalid tokens ==================')
  await attestInvalidToken(alph)

  console.log('================== attest tokens ==================')
  await attestTokens(alph, eth, bsc)

  console.log('================== transfer between Alephium and BSC ==================')
  const pair0 = new ChainPair(alph, bsc)
  await pair0.test(50)

  console.log('================== transfer between Alephium and ETH ==================')
  const pair1 = new ChainPair(alph, eth)
  await pair1.test(50)

  console.log('================== transfer between ETH and BSC ==================')
  const pair2 = new ChainPair(eth, bsc)
  await pair2.test(50)
}

test()
