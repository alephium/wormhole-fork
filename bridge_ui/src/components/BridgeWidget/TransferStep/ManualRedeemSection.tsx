import { CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH, CHAIN_ID_ETHEREUM_ROPSTEN } from '@alephium/wormhole-sdk'
import { Checkbox, FormControlLabel, Typography } from '@material-ui/core'
import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import useGetIsTransferCompleted from '../../../hooks/useGetIsTransferCompleted'
import { useHandleRedeem } from '../../../hooks/useHandleRedeem'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import {
  selectTransferIsRecovery,
  selectTransferIsRedeeming,
  selectTransferTargetAsset,
  selectTransferTargetChain,
  selectTransferUseRelayer} from '../../../store/selectors'
import { ROPSTEN_WETH_ADDRESS, WBNB_ADDRESS, WETH_ADDRESS } from '../../../utils/consts'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { GRAY, useWidgetStyles } from '../styles'
import BridgeWidgetButton from '../BridgeWidgetButton'
import useManualRedeemNecessary from '../../../hooks/useManualRedeemNecessary'

const ManualRedeemSection = () => {
  const widgetClasses = useWidgetStyles()
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const { handleClick, handleNativeClick, disabled } = useHandleRedeem()
  const useRelayer = useSelector(selectTransferUseRelayer)
  const targetChain = useSelector(selectTransferTargetChain)
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const targetAsset = useSelector(selectTransferTargetAsset)
  const isRecovery = useSelector(selectTransferIsRecovery)
  const isRedeeming = useSelector(selectTransferIsRedeeming)
  
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const {
    isTransferCompletedLoading,
    isTransferCompleted,
    error: checkTransferCompletedError
  } = useGetIsTransferCompleted(!shouldCheckCompletion, shouldCheckCompletion ? 5000 : undefined)

  const { isReady } = useIsWalletReady(targetChain)
  //TODO better check, probably involving a hook & the VAA
  const isEthNative =
    targetChain === CHAIN_ID_ETH && targetAsset && targetAsset.toLowerCase() === WETH_ADDRESS.toLowerCase()
  const isEthRopstenNative =
    targetChain === CHAIN_ID_ETHEREUM_ROPSTEN &&
    targetAsset &&
    targetAsset.toLowerCase() === ROPSTEN_WETH_ADDRESS.toLowerCase()
  const isBscNative =
    targetChain === CHAIN_ID_BSC && targetAsset && targetAsset.toLowerCase() === WBNB_ADDRESS.toLowerCase()
  const isNativeEligible = isEthNative || isEthRopstenNative || isBscNative
  const [useNativeRedeem, setUseNativeRedeem] = useState(true)
  const toggleNativeRedeem = useCallback(() => {
    setUseNativeRedeem(!useNativeRedeem)
  }, [useNativeRedeem])

  useEffect(() => {
    if (checkTransferCompletedError) {
      enqueueSnackbar(checkTransferCompletedError, {
        variant: 'error',
        preventDuplicate: true
      })
    }
  }, [checkTransferCompletedError, enqueueSnackbar])

  const isRedeemDisabled =
    !isReady ||
    disabled ||
    (isRecovery && (isTransferCompletedLoading || isTransferCompleted)) ||
    checkTransferCompletedError !== undefined

    const { manualRedeemToAlephiumRequired, manualRedeemToEvmRequired } = useManualRedeemNecessary()

  if (manualRedeemToAlephiumRequired || manualRedeemToEvmRequired) {
    return (
      <div className={widgetClasses.grayRoundedBox}>
        {manualRedeemToAlephiumRequired ? (
          <div>
            <Typography style={{ fontWeight: 600 }}>The relayer is busy at the moment.</Typography>
            <Typography>
              <span style={{ color: GRAY }}>No worries. Redeem manually. We'll refund your fees.</span> 🤝
            </Typography>
          </div>
        ) : (
          <div>
            <Typography style={{ fontWeight: 600 }}>The wait is over, you can now claim your tokens!</Typography>
            <Typography>
              <span style={{ color: GRAY, fontSize: '14px' }}>
                Redeem below and the tokens will be sent to your wallet.
              </span>
            </Typography>
          </div>
        )}
        <div>
          {isNativeEligible && (
            <FormControlLabel
              control={<Checkbox checked={useNativeRedeem} onChange={toggleNativeRedeem} color="primary" />}
              label={t('Automatically unwrap to native currency')}
            />
          )}
        </div>
        <BridgeWidgetButton
          disabled={isRedeemDisabled}
          onClick={isNativeEligible && useNativeRedeem ? handleNativeClick : handleClick}
          tone="primaryNext"
          isLoading={isRedeeming}
        >
          Redeem
        </BridgeWidgetButton>
      </div>
    )
  } else {
    return null
  }
}

export default ManualRedeemSection
