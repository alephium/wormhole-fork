import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Alert } from '@mui/material'
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from '@alephium/wormhole-sdk'
import {
  selectTransferHasSentTokens,
  selectTransferSourceChain,
  selectTransferTargetChain
} from '../../../../store/selectors'
import useIsWalletReady from '../../../../hooks/useIsWalletReady'
import { getConst } from '../../../../utils/consts'
import { useWidgetStyles } from '../../styles'
import { TransferCompletionState } from '../../../../hooks/useGetIsTransferCompleted'
import ConnectWalletButton from '../../ConnectWalletButton'
import useTransferOrRecoveryTxExists from '../../useTransferOrRecoveryTxExists'

const SUPPORTED_CHAINS: ChainId[] = [CHAIN_ID_ETH, CHAIN_ID_BSC, CHAIN_ID_ALEPHIUM] // TODO: Update when more chains are supported

interface WalletReconnectSectionProps {
  isTransferCompleted: TransferCompletionState
}

const WalletReconnectSection = ({ isTransferCompleted }: WalletReconnectSectionProps) => {
  const { classes } = useWidgetStyles()
  const txExists = useTransferOrRecoveryTxExists()
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)

  const { isReady: isSourceWalletReady } = useIsWalletReady(sourceChain, false)
  const { isReady: isTargetWalletReady } = useIsWalletReady(targetChain, false)

  const disconnectedChains = useMemo(() => {
    if (!txExists || hasSentTokens) return []

    return [
      !isSourceWalletReady && SUPPORTED_CHAINS.includes(sourceChain) && sourceChain,
      !isTargetWalletReady && SUPPORTED_CHAINS.includes(targetChain) && targetChain
    ].filter(Boolean) as ChainId[]
  }, [hasSentTokens, isSourceWalletReady, isTargetWalletReady, sourceChain, targetChain, txExists])

  if (disconnectedChains.length === 0) return null

  return (
    <>
      {disconnectedChains.map((chainId) => {
        const chainName = getConst('CHAINS_BY_ID')[chainId]?.name ?? 'selected chain'

        return (
          <div className={classes.grayRoundedBox} key={`wallet-reconnect-${chainId}`}>
            <Alert severity="warning" style={{ marginBottom: 16 }}>
              Wallet for {chainName} is disconnected
            </Alert>

            <ConnectWalletButton chainId={chainId} tone="primaryNext">
              Reconnect {chainName} wallet
            </ConnectWalletButton>
          </div>
        )
      })}
    </>
  )
}

export default WalletReconnectSection
