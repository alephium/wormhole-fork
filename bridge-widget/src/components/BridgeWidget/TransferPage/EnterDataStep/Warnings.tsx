import { useSelector } from 'react-redux'
import {
  selectTransferSourceAssetInfoWrapper,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetAssetWrapper,
  selectTransferTargetChain,
  selectTransferTargetError
} from '../../../../store/selectors'
import UnregisteredTokenWarning from './UnregisteredTokenWarning'
import LowBalanceWarning from '../../../LowBalanceWarning'
import SourceAssetWarning from '../../../Transfer/SourceAssetWarning'
import ChainWarningMessage from '../../../ChainWarningMessage'
import useIsWalletReady from '../../../../hooks/useIsWalletReady'
import { useEffect } from 'react'

const Warnings = () => {
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const parsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)
  const { isReady: isSourceChainReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetChainReady, statusMessage } = useIsWalletReady(targetChain)
  const targetError = useSelector(selectTransferTargetError)
  const { error: targetAssetError } = useSelector(selectTransferTargetAssetWrapper)
  const { error: fetchSourceAssetInfoError } = useSelector(selectTransferSourceAssetInfoWrapper)
  const walletsReady = isSourceChainReady && isTargetChainReady

  const error = statusMessage || fetchSourceAssetInfoError || targetError || targetAssetError

  useEffect(() => {
    if (error) {
      // These errors are not useful in the UI. Examples:
      // Error in source: Select a token
      // Error in source: Enter an amount
      // Wallet is not connected
      // The UI is already handling these by showing the right button as the next step.
      // Keeping this here in case I missed something and we need it.
      console.log(error)
    }
  }, [error])

  const shouldShowTransferWarnings = walletsReady && !!parsedTokenAccount

  if (!shouldShowTransferWarnings) return null

  return (
    <>
      <LowBalanceWarning chainId={sourceChain} />
      <SourceAssetWarning sourceChain={sourceChain} sourceAsset={parsedTokenAccount?.mintKey} />
      <ChainWarningMessage chainId={sourceChain} />
      <ChainWarningMessage chainId={targetChain} />
      <UnregisteredTokenWarning />
    </>
  )
}

export default Warnings
