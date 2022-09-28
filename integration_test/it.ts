import { createAlephium } from './alph'
import { createEth } from './eth'
import { BridgeChain, TransferTokenTest } from './utils'

async function attestTokens(alph: BridgeChain, eth: BridgeChain) {
  const signedVaa0 = await alph.attestToken(alph.testTokenId)
  await eth.createWrapped(signedVaa0)
  const signedVaa1 = await alph.attestToken(alph.wrappedNativeTokenId)
  await eth.createWrapped(signedVaa1)

  const signedVaa2 = await eth.attestToken(eth.testTokenId)
  await alph.createWrapped(signedVaa2)
  const signedVaa3 = await eth.attestToken(eth.wrappedNativeTokenId)
  await alph.createWrapped(signedVaa3)
}

function randomBigInt(max: bigint, normalizeFunc: (amount: bigint) => bigint): bigint {
  const length = max.toString().length
  let multiplier = ''
  while (multiplier.length < length) {
    multiplier += Math.random().toString().split('.')[1]
  }
  multiplier = multiplier.slice(0, length)
  const num = (max * BigInt(multiplier)) / 10n ** BigInt(length)
  const normalized = normalizeFunc(num)
  return normalized === 0n ? randomBigInt(max, normalizeFunc) : normalized
}

async function test() {
  const alph = await createAlephium()
  const eth = createEth()

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

  const transferWALPHFromAlphToEth = async () => {
    const remain = await alph.getNativeTokenBalance()
    // minus 1 alph for tx fee
    const amount = randomBigInt(remain - alph.oneCoin, alph.normalizeTransferAmount)
    await alphToEth.transferNativeToken(amount + alph.messageFee)
    await ethToAlph.transferWrappedNativeToken(amount)
  }

  const transferTestTokenFromEthToAlph = async () => {
    const remain = await eth.getTokenBalance(eth.testTokenId)
    const amount = randomBigInt(remain, eth.normalizeTransferAmount)
    await ethToAlph.transferTestToken(amount)
    await alphToEth.transferWrappedTestToken(amount)
  }

  const transferWETHFromEthToAlph = async () => {
    const remain = await eth.getNativeTokenBalance()
    // minus 1 eth for tx fee
    const amount = randomBigInt(remain - eth.oneCoin, eth.normalizeTransferAmount)
    await ethToAlph.transferNativeToken(amount + eth.messageFee)
    await alphToEth.transferWrappedNativeToken(amount)
  }

  const transfers = [
    transferTestTokenFromAlphToEth,
    transferWALPHFromAlphToEth,
    transferTestTokenFromEthToAlph,
    transferWETHFromEthToAlph
  ]

  const transferTimes = 30
  for (let i = 0; i < transferTimes; i++) {
    const index = Math.floor(Math.random() * 4)
    const func = transfers[index]
    await func()
  }
}

test()
