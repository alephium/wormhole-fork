import { Typography } from '@mui/material'
import { useSelector } from 'react-redux'
import {
  selectTransferAmount,
  selectTransferSourceParsedTokenAccount,
  selectTransferSourceChain,
  selectSourceWalletAddress,
  selectTransferRelayerFee,
  selectTransferSourceAsset,
  selectTransferIsSending
} from '../../../store/selectors'
import SmartAddress from '../SmartAddress'
import { getConst } from '../../../utils/consts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import { hexToALPHAddress } from '../../../utils/alephium'
import useTargetInfo from '../../../hooks/useTargetInfo'
import numeral from 'numeral'
import useAllowance from '../../../hooks/useAllowance'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { useTranslation } from 'react-i18next'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import { useHandleTransfer } from '../../../hooks/useHandleTransfer'
import BridgeWidgetButton from '../BridgeWidgetButton'
import SendingAmount from '../SendingAmount'
import SendingAddress from '../SendingAddress'
import { GRAY, useWidgetStyles } from '../styles'
import WarningBox from '../WarningBox'
import Divider from '../Divider'
import { useSnackbar } from 'notistack'
import { Alert } from '@mui/material'
import ConnectWalletButton from '../ConnectWalletButton'

interface ReviewStepProps {
  onBack: () => void
  onNext: () => void
}

const ReviewStep = ({ onBack, onNext }: ReviewStepProps) => {
  const { classes } = useWidgetStyles()
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()

  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)
  const sourceAmount = useSelector(selectTransferAmount)

  const sourceChain = useSelector(selectTransferSourceChain)
  const sourceWalletAddress = useSelector(selectSourceWalletAddress)
  const sourceAsset = useSelector(selectTransferSourceAsset)
  const relayerFee = useSelector(selectTransferRelayerFee)
  const sourceDecimals = sourceParsedTokenAccount?.decimals
  const sourceIsNative = sourceParsedTokenAccount?.isNativeAsset
  const baseAmountParsed =
    sourceDecimals !== undefined && sourceDecimals !== null && sourceAmount && parseUnits(sourceAmount, sourceDecimals)
  const feeParsed = sourceDecimals !== undefined ? parseUnits(relayerFee || '0', sourceDecimals) : 0
  const transferAmountParsed = baseAmountParsed && baseAmountParsed.add(feeParsed).toBigInt()

  const { targetChain, readableTargetAddress, targetAsset, symbol, tokenName, logo } = useTargetInfo()
  const targetChainInfo = useMemo(() => getConst('CHAINS_BY_ID')[targetChain], [targetChain])

  const { isReady: isSourceWalletReady, statusMessage, walletAddress } = useIsWalletReady(sourceChain)
  const { isReady: isTargetWalletReady, statusMessage: targetStatusMessage } = useIsWalletReady(targetChain)

  const { sufficientAllowance, isAllowanceFetching, isApproveProcessing, approveAmount } = useAllowance(
    sourceChain,
    sourceAsset,
    transferAmountParsed || undefined,
    sourceIsNative
  )

  const approveButtonNeeded = isSourceWalletReady && isEVMChain(sourceChain) && !sufficientAllowance
  const [allowanceError, setAllowanceError] = useState('')
  const lastSourceStatusRef = useRef<string | null>(null)
  const lastTargetStatusRef = useRef<string | null>(null)

  const approveExactAmount = useMemo(() => {
    return () => {
      setAllowanceError('')
      approveAmount(BigInt(transferAmountParsed)).then(
        () => {
          setAllowanceError('')
        },
        () => setAllowanceError(t('Failed to approve the token transfer.'))
      )
    }
  }, [approveAmount, transferAmountParsed, t])

  const isWrongWallet = sourceWalletAddress && walletAddress && sourceWalletAddress !== walletAddress
  const { handleClick, disabled } = useHandleTransfer()
  const isSending = useSelector(selectTransferIsSending)

  const connectChainId = useMemo<ChainId | null>(() => {
    if (!isSourceWalletReady) return sourceChain
    if (!isTargetWalletReady) return targetChain
    return null
  }, [isSourceWalletReady, sourceChain, isTargetWalletReady, targetChain])

  const isEvmChain = connectChainId && isEVMChain(connectChainId)
  const isAlephiumChain = connectChainId === CHAIN_ID_ALEPHIUM
  const isConnectAction = connectChainId !== null
  const isConnectSupported = isEvmChain || isAlephiumChain

  useEffect(() => {
    if (!statusMessage) {
      lastSourceStatusRef.current = null
      return
    }
    if (connectChainId !== sourceChain) {
      lastSourceStatusRef.current = null
      return
    }
    if (lastSourceStatusRef.current === statusMessage) {
      return
    }
    enqueueSnackbar(null, { content: <Alert severity="warning">{statusMessage}</Alert> })
    lastSourceStatusRef.current = statusMessage
  }, [connectChainId, enqueueSnackbar, sourceChain, statusMessage])

  useEffect(() => {
    if (!targetStatusMessage) {
      lastTargetStatusRef.current = null
      return
    }
    if (connectChainId !== targetChain) {
      lastTargetStatusRef.current = null
      return
    }
    if (lastTargetStatusRef.current === targetStatusMessage) {
      return
    }
    enqueueSnackbar(null, { content: <Alert severity="warning">{targetStatusMessage}</Alert> })
    lastTargetStatusRef.current = targetStatusMessage
  }, [connectChainId, enqueueSnackbar, targetChain, targetStatusMessage])

  const handleTransferClick = useCallback(() => {
    handleClick()
    onNext()
  }, [handleClick, onNext])

  const isButtonDisabled = isConnectAction
    ? !isConnectSupported
    : isWrongWallet || disabled || isAllowanceFetching || isApproveProcessing

  const connectWalletLabel = useMemo(() => {
    if (!isConnectAction || connectChainId === null) {
      return t('Connect wallet')
    }

    const chainName = getConst('CHAINS_BY_ID')[connectChainId]?.name
    return chainName ? `Connect ${chainName} wallet` : t('Connect wallet')
  }, [connectChainId, isConnectAction, t])

  const primaryButtonLabel = isConnectAction ? connectWalletLabel : t('Transfer')
  const primaryButtonTone: 'default' | 'primaryNext' = isConnectAction ? 'default' : 'primaryNext'

  const humanReadableTransferAmount =
    sourceDecimals !== undefined &&
    sourceDecimals !== null &&
    transferAmountParsed &&
    formatUnits(transferAmountParsed, sourceDecimals)
  let tokensAmount = 0
  try {
    tokensAmount = Number(humanReadableTransferAmount || sourceAmount)
  } catch (e) {
    console.error(e)
  }

  return (
    <>
      <div className={classes.grayRoundedBox}>
        {sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography>Sending</Typography>
              <div className={classes.networkAddressText}>
                <SendingAmount />
              </div>
            </div>
          </div>
        )}

        <Divider />

        {sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography>From</Typography>
              <div className={classes.networkAddressText}>
                <SendingAddress showIcon />
              </div>
            </div>
          </div>
        )}

        <Divider />

        <div className={classes.spaceBetween}>
          <Typography>To</Typography>
          <div className={classes.networkAddressText}>
            <Typography style={{ display: 'flex', alignItems: 'center', gap: '5px', color: GRAY }}>
              <img src={targetChainInfo.logo} alt={targetChainInfo.name} className={classes.networkIcon} />
              {targetChainInfo.name} address
            </Typography>
            <SmartAddress
              chainId={targetChain}
              address={
                targetChain === CHAIN_ID_ALEPHIUM ? hexToALPHAddress(readableTargetAddress) : readableTargetAddress
              }
            />
          </div>
        </div>

        <Divider />

        {targetAsset && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography>Receiving</Typography>
              <div className={classes.networkAddressText}>
                <Typography style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: 'bold' }}>{sourceAmount}</span>{' '}
                  <SmartAddress
                    chainId={targetChain}
                    address={targetAsset}
                    symbol={symbol}
                    tokenName={tokenName}
                    logo={logo}
                    isAsset
                  />
                  {logo && <img alt="" className={classes.networkIcon} src={logo} />}
                </Typography>
              </div>
            </div>
          </div>
        )}

        {relayerFee && sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography style={{ fontWeight: 'bold' }}>Relayer Fee</Typography>
              <div className={classes.networkAddressText}>
                <Typography style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontWeight: 'bold' }}>{numeral(relayerFee).format('0.00')}</span>{' '}
                  <SmartAddress chainId={sourceChain} parsedTokenAccount={sourceParsedTokenAccount} isAsset />
                  {sourceParsedTokenAccount.logo && (
                    <img alt="" className={classes.networkIcon} src={sourceParsedTokenAccount.logo} />
                  )}
                </Typography>
              </div>
            </div>
          </div>
        )}
      </div>

      {allowanceError && <WarningBox>{allowanceError}</WarningBox>}

      <BridgeWidgetButton onClick={onBack} variant="outlined">
        Back
      </BridgeWidgetButton>

      {approveButtonNeeded ? (
        <BridgeWidgetButton
          disabled={isWrongWallet || disabled || isAllowanceFetching || isApproveProcessing}
          onClick={approveExactAmount}
          isLoading={isApproveProcessing}
        >
          {t('approveTokens', { count: tokensAmount, symbol: sourceParsedTokenAccount?.symbol || '' })}
        </BridgeWidgetButton>
      ) : isSending ? (
        <BridgeWidgetButton onClick={onNext}>View current transfer progress</BridgeWidgetButton>
      ) : isConnectAction ? (
        <ConnectWalletButton chainId={connectChainId} disabled={isButtonDisabled} tone={primaryButtonTone}>
          {primaryButtonLabel}
        </ConnectWalletButton>
      ) : (
        <BridgeWidgetButton onClick={handleTransferClick} disabled={isButtonDisabled} tone={primaryButtonTone}>
          {primaryButtonLabel}
        </BridgeWidgetButton>
      )}
    </>
  )
}

export default ReviewStep
