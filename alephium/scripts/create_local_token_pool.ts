import { Project, web3 } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { program } from 'commander'
import { loadConfig } from '../lib/deployment'
import { waitTxConfirmed } from '../lib/utils'

const oneAlph = BigInt('1000000000000000000')

program
  .option('--config <config-file>', 'Config file')
  .requiredOption('--tokenBridgeId <token-bridge-id>', 'Token bridge id')
  .requiredOption('--localTokenId <local-token-id>', 'Local token id')
  .action(async (options) => {
    try {
      const configFilepath = options.config ? (options.config as string) : 'configuration.ts'
      const config = await loadConfig(configFilepath)
      const network = config.networks[config.defaultNetwork]
      web3.setCurrentNodeProvider(network.nodeUrl)
      await Project.build(config.compilerOptions, config.sourcePath, config.artifactPath)
      const signer = PrivateKeyWallet.FromMnemonic(network.mnemonic)
      const accounts = await signer.getAccounts()
      const script = Project.script('CreateLocalTokenPool')
      const result = await script.transactionForDeployment(signer, {
        initialFields: {
          payer: accounts[0].address,
          tokenBridge: options.tokenBridgeId as string,
          localTokenId: options.localTokenId as string,
          alphAmount: oneAlph
        }
      })
      await signer.submitTransaction(result.unsignedTx)
      await waitTxConfirmed(signer.provider, result.txId, network.confirmations)
      console.log(`Create local token pool succeed, tx id: ${result.txId}`)
    } catch (error) {
      program.error(`failed to create local token pool, error: ${error}`)
    }
  })

program.parseAsync()
