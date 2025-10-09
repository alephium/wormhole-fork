import { useCallback, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Alert } from '@material-ui/lab'
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from '@alephium/wormhole-sdk'
import {
  selectTransferHasSentTokens,
  selectTransferSourceChain,
  selectTransferTargetChain,
  selectTransferTransferTx
} from '../../../store/selectors'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import { useConnect } from '@alephium/web3-react'
import { CHAINS_BY_ID } from '../../../utils/consts'
import { useWidgetStyles } from '../styles'
import BridgeWidgetButton from '../BridgeWidgetButton'
import EvmConnectWalletDialog from '../../EvmConnectWalletDialog'
import { TransferCompletionState } from '../../../hooks/useGetIsTransferCompleted'

const SUPPORTED_CHAINS: ChainId[] = [CHAIN_ID_ETH, CHAIN_ID_BSC, CHAIN_ID_ALEPHIUM] // TODO: Update when more chains are supported

interface WalletReconnectSectionProps {
  isTransferCompleted: TransferCompletionState
}

const WalletReconnectSection = ({ isTransferCompleted }: WalletReconnectSectionProps) => {
  const classes = useWidgetStyles()
  const transferTx = useSelector(selectTransferTransferTx)
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { connect: connectAlephium } = useConnect()
  const [evmChainToConnect, setEvmChainToConnect] = useState<ChainId | null>(null)

  const { isReady: isSourceWalletReady } = useIsWalletReady(sourceChain, false)
  const { isReady: isTargetWalletReady } = useIsWalletReady(targetChain, false)

  const disconnectedChains = useMemo(() => {
    if (!transferTx || hasSentTokens) return []

    return [
      !isSourceWalletReady && SUPPORTED_CHAINS.includes(sourceChain) && sourceChain,
      !isTargetWalletReady && SUPPORTED_CHAINS.includes(targetChain) && targetChain,
    ].filter(Boolean) as ChainId[]
  }, [hasSentTokens, isSourceWalletReady, isTargetWalletReady, sourceChain, targetChain, transferTx])

  const handleReconnect = useCallback((chainId: ChainId) => {
    if (chainId === CHAIN_ID_ALEPHIUM) {
      connectAlephium()
      return
    }

    if (chainId === CHAIN_ID_ETH || chainId === CHAIN_ID_BSC) {
      setEvmChainToConnect(chainId)
    }
  }, [connectAlephium])

  if (disconnectedChains.length === 0) return null

  return (
    <>
      {disconnectedChains.map((chainId) => {
        const chainName = CHAINS_BY_ID[chainId]?.name ?? 'selected chain'

        return (
          <div className={classes.grayRoundedBox} key={`wallet-reconnect-${chainId}`}>
            <Alert severity="warning" style={{ marginBottom: 16 }}>
              Wallet for {chainName} is disconnected
            </Alert>

            <BridgeWidgetButton
              onClick={() => handleReconnect(chainId)}
              tone="primaryNext"
            >
              Reconnect {chainName} wallet
            </BridgeWidgetButton>
          </div>
        )
      })}

      {evmChainToConnect !== null && (
        <EvmConnectWalletDialog
          isOpen
          onClose={() => setEvmChainToConnect(null)}
          chainId={evmChainToConnect}
        />
      )}
    </>
  )
}

export default WalletReconnectSection
