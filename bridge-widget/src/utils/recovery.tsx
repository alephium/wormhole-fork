import { ChainId, getEmitterAddressEth, parseSequenceFromLogEth, uint8ArrayToHex, parseTargetChainFromLogEth } from '@alephium/wormhole-sdk'
import { ethers } from 'ethers'
import { getBridgeAddressForChain, getNFTBridgeAddressForChain, getTokenBridgeAddressForChain, getConst } from './consts'
import { getSignedVAAWithRetry } from './getSignedVAAWithRetry'
import parseError from './parseError'
import { Alert } from '@mui/material'
import { getEVMCurrentBlockNumber, isEVMTxConfirmed } from './evm'

import i18n from '../i18n'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function evm(provider: ethers.providers.Web3Provider, tx: string, enqueueSnackbar: any, chainId: ChainId, nft: boolean) {
  try {
    const receipt = await provider.getTransactionReceipt(tx)
    const currentBlockNumber = await getEVMCurrentBlockNumber(provider, chainId)
    if (!isEVMTxConfirmed(chainId, receipt.blockNumber, currentBlockNumber)) {
      throw new Error(i18n.t('The transaction is awaiting confirmation'))
    }
    const sequence = parseSequenceFromLogEth(receipt, getBridgeAddressForChain(chainId))
    const targetChain = parseTargetChainFromLogEth(receipt, getBridgeAddressForChain(chainId))
    const emitterAddress = getEmitterAddressEth(nft ? getNFTBridgeAddressForChain(chainId) : getTokenBridgeAddressForChain(chainId))
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      targetChain,
      sequence.toString(),
      getConst('WORMHOLE_RPC_HOSTS').length
    )
    return { vaa: uint8ArrayToHex(vaaBytes), error: null }
  } catch (e) {
    console.error(e)
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>
    })
    return { vaa: null, error: parseError(e) }
  }
}
