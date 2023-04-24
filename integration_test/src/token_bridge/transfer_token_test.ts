import { execSync } from 'child_process'
import { BridgeChain } from '../bridge_chain'
import { getBridgeChains, randomBigInt } from '../utils'
import { TransferTokenTest } from './transfer_token'

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

async function test() {
  const chains = await getBridgeChains()
  const alph = chains.alph
  const eth = chains.eth

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
