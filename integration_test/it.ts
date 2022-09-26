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

async function test() {
  const alph = await createAlephium()
  const eth = createEth()

  console.log('================== attest tokens ==================')
  await attestTokens(alph, eth)

  console.log('================== transfer test ==================')
  const alphToEth = new TransferTokenTest(alph, eth)
  const ethToAlph = new TransferTokenTest(eth, alph)

  await alphToEth.transferTestToken(1111n)
  await ethToAlph.transferWrappedTestToken(1111n)

  await alphToEth.transferNativeToken(2222n + alph.messageFee)
  await ethToAlph.transferWrappedNativeToken(2222n)

  const unit = BigInt(Math.pow(10, 10)) // mul unit because of normalization
  await ethToAlph.transferTestToken(3333n * unit)
  await alphToEth.transferWrappedTestToken(3333n * unit)

  await ethToAlph.transferNativeToken(4444n * unit)
  await alphToEth.transferWrappedNativeToken(4444n * unit)
}

test()
