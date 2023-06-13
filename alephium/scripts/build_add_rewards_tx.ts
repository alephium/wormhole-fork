import {
  NetworkId,
  web3,
  networkIds,
  SignExecuteScriptTxParams,
  addressFromPublicKey,
  TransactionBuilder,
  ONE_ALPH,
  DUST_AMOUNT
} from '@alephium/web3'
import { loadDeployments } from '../artifacts/ts/deployments'
import config from '../alephium.config'
import { program, Option } from 'commander'
import { AddRewards } from '../artifacts/ts'

async function addRewards(senderPublicKey: string, networkId: NetworkId, amount: number) {
  const network = config.networks[networkId]
  web3.setCurrentNodeProvider(network.nodeUrl)
  const deployments = loadDeployments(networkId)
  const bridgeRewardRouterId = deployments.contracts.BridgeRewardRouter?.contractInstance.contractId
  if (bridgeRewardRouterId === undefined) {
    throw new Error('The BridgeRewardRouter contract is not deployed')
  }
  const caller = addressFromPublicKey(senderPublicKey)
  const alphAmount = BigInt(amount) * ONE_ALPH
  const initialFields = {
    bridgeRewardRouter: bridgeRewardRouterId,
    amount: alphAmount
  }
  const params: SignExecuteScriptTxParams = {
    signerAddress: caller,
    signerKeyType: 'default',
    bytecode: AddRewards.script.buildByteCodeToDeploy(initialFields),
    attoAlphAmount: alphAmount + DUST_AMOUNT
  }
  const buildUnsignedTxResult = await TransactionBuilder.from(web3.getCurrentNodeProvider()).buildExecuteScriptTx(
    params,
    senderPublicKey
  )
  console.log(`AddRewards tx id: ${buildUnsignedTxResult.txId}, unsigned tx: ${buildUnsignedTxResult.unsignedTx}`)
}

program
  .description('build unsigned tx used to add bridge rewards')
  .addOption(new Option('--network-id <string>', 'network id').choices(networkIds).makeOptionMandatory())
  .requiredOption('--sender-public-key <string>', 'the public key of the tx sender')
  .requiredOption('--amount <string>', 'ALPH amount')
  .action(async (opts) => {
    try {
      const publicKey = opts.senderPublicKey as string
      const amount = parseInt(opts.amount as string)
      const networkId = opts.networkId as NetworkId
      await addRewards(publicKey, networkId, amount)
    } catch (error) {
      console.error(`Failed to build unsgined tx, error: ${error}`)
    }
  })

program.parse()
