import { Project } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { program } from 'commander'
import { getEnv } from '@alephium/cli'
import { waitTxConfirmed } from '../lib/utils'
import { Settings } from '../alephium.config'

program
  .option('--config <config-file>', 'Config file')
  .requiredOption('--tokenBridgeId <token-bridge-id>', 'Token bridge id')
  .requiredOption('--localTokenId <local-token-id>', 'Local token id')
  .action(async (options) => {
    try {
      const env = await getEnv<Settings>()
      const signer = PrivateKeyWallet.FromMnemonic(env.network.mnemonic)
      const script = Project.script('CreateLocalTokenPool')
      const result = await script.execute(signer, {
        initialFields: {
          payer: signer.account.address,
          tokenBridge: options.tokenBridgeId as string,
          localTokenId: options.localTokenId as string,
          alphAmount: 10n ** 18n
        }
      })
      await waitTxConfirmed(signer.nodeProvider, result.txId, env.network.confirmations!)
      console.log(`Create local token pool succeed, tx id: ${result.txId}`)
    } catch (error) {
      program.error(`failed to create local token pool, error: ${error}`)
    }
  })

program.parseAsync()