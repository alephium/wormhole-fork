import { execSync } from 'child_process'
import { AlephiumBridgeChain } from '../alph'
import { assert, getBridgeChains, normalizeTokenId, randomBigInt } from '../utils'
import { TransferTokenTest } from './transfer_token'
import { default as alephiumDevnetConfig } from '../../../configs/alephium/devnet.json'
import { ALPH as ALPHTokenInfo } from '@alephium/token-list'
import { BridgeChain } from '../bridge_chain'

async function attestInvalidToken(alph: AlephiumBridgeChain) {
  const testTokenInfo = await alph.getLocalTokenInfo(alephiumDevnetConfig.contracts.testToken)
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

async function attestTokens(alph: AlephiumBridgeChain, eth: BridgeChain) {
  const testTokenInfo = await alph.getLocalTokenInfo(alephiumDevnetConfig.contracts.testToken)
  const signedVaa0 = await alph.attestWithTokenInfo(
    alph.testTokenId,
    testTokenInfo.decimals,
    testTokenInfo.symbol,
    testTokenInfo.name
  )
  await eth.createWrapped(signedVaa0)
  await checkWrappedToken(alph, eth, alph.testTokenId)

  const signedVaa1 = await alph.attestWithTokenInfo(
    alph.wrappedNativeTokenId,
    ALPHTokenInfo.decimals,
    ALPHTokenInfo.symbol,
    ALPHTokenInfo.name
  )
  await eth.createWrapped(signedVaa1)
  await checkWrappedToken(alph, eth, alph.wrappedNativeTokenId)

  const signedVaa2 = await eth.attestToken(eth.testTokenId)
  await alph.createWrapped(signedVaa2)
  await checkWrappedToken(eth, alph, eth.testTokenId)

  const signedVaa3 = await eth.attestToken(eth.wrappedNativeTokenId)
  await alph.createWrapped(signedVaa3)
  await checkWrappedToken(eth, alph, eth.wrappedNativeTokenId)
}

async function test() {
  const chains = await getBridgeChains()
  const alph = chains.alph
  const eth = chains.eth

  console.log('================== attest invalid tokens ==================')
  await attestInvalidToken(alph)

  console.log('================== attest tokens ==================')
  await attestTokens(alph, eth)

  console.log('================== transfer test ==================')
  const alphToEth = new TransferTokenTest(alph, eth)
  const ethToAlph = new TransferTokenTest(eth, alph)

  const transferTestTokenFromAlphToEth = async () => {
    const remain = await alph.getTokenBalance(alph.testTokenId)
    const amount = randomBigInt(remain, alph.normalizeTransferAmount)
    await alphToEth.transferTestToken(amount)
    await ethToAlph.transferWrappedTestToken(amount)
  }

  const transferALPHFromAlphToEth = async () => {
    const remain = await alph.getNativeTokenBalance()
    // minus 1 alph for tx fee
    const amount = randomBigInt(remain - alph.oneCoin, alph.normalizeTransferAmount)
    // we will add the `messageFee` to the `amount` in the `transferNativeToken` function
    await alphToEth.transferNativeToken(amount)
    await ethToAlph.transferWrappedNativeToken(amount)
  }

  const transferTestTokenFromEthToAlph = async () => {
    const remain = await eth.getTokenBalance(eth.testTokenId)
    const amount = randomBigInt(remain, eth.normalizeTransferAmount)
    const normalizedTokenId = normalizeTokenId(eth.testTokenId)
    await ethToAlph.transferTestToken(amount)
    assert((await alph.getWrappedTokenTotalSupply(eth.chainId, normalizedTokenId)) === amount)
    await alphToEth.transferWrappedTestToken(amount)
    assert((await alph.getWrappedTokenTotalSupply(eth.chainId, normalizedTokenId)) === 0n)
  }

  const transferWETHFromEthToAlph = async () => {
    const remain = await eth.getNativeTokenBalance()
    // minus 1 eth for tx fee
    const amount = randomBigInt(remain - eth.oneCoin, eth.normalizeTransferAmount)
    const normalizedNativeTokenId = normalizeTokenId(eth.wrappedNativeTokenId)
    // we will add the `messageFee` to the `amount` in the `transferNativeToken` function
    await ethToAlph.transferNativeToken(amount)
    assert((await alph.getWrappedTokenTotalSupply(eth.chainId, normalizedNativeTokenId)) === amount)
    await alphToEth.transferWrappedNativeToken(amount)
    assert((await alph.getWrappedTokenTotalSupply(eth.chainId, normalizedNativeTokenId)) === 0n)
  }

  const transfers = [
    transferTestTokenFromAlphToEth,
    transferALPHFromAlphToEth,
    transferTestTokenFromEthToAlph,
    transferWETHFromEthToAlph
  ]

  const transferTimes = 100
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

  console.log('================= transfer tokens to multi-sig address =================')
  await ethToAlph.transferToMultiSigAddress(10)
}

test()
