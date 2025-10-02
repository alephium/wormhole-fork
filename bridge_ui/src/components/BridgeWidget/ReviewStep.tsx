import { IconButton, Typography } from '@material-ui/core'
import { ArrowBack } from '@material-ui/icons'
import { useSelector } from 'react-redux'
import {
  selectTransferAmount,
  selectTransferSourceParsedTokenAccount,
  selectTransferSourceChain,
  selectSourceWalletAddress,
  selectTransferRelayerFee,
  selectTransferSourceAsset,
  selectTransferIsSending
} from '../../store/selectors'
import SmartAddress from './SmartAddress'
import { CHAINS_BY_ID } from '../../utils/consts'
import { useCallback, useMemo, useState } from 'react'
import { CHAIN_ID_ALEPHIUM, isEVMChain } from '@alephium/wormhole-sdk'
import { hexToALPHAddress } from '../../utils/alephium'
import { useTargetInfo } from '../Transfer/Target'
import numeral from 'numeral'
import useAllowance from '../../hooks/useAllowance'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import { useTranslation } from 'react-i18next'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import { useHandleTransfer } from '../../hooks/useHandleTransfer'
import BridgeWidgetButton from './BridgeWidgetButton'
import SendingAmount from './SendingAmount'
import SendingAddress from './SendingAddress'
import { GRAY, useWidgetStyles } from './styles'
import WarningBox from './WarningBox'
import Divider from './Divider'

interface ReviewStepProps {
  onBack: () => void
  onNext: () => void
}

const ReviewStep = ({ onBack, onNext }: ReviewStepProps) => {
  const classes = useWidgetStyles()
  const { t } = useTranslation()

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
  const targetChainInfo = useMemo(() => CHAINS_BY_ID[targetChain], [targetChain])

  const { sufficientAllowance, isAllowanceFetching, isApproveProcessing, approveAmount } = useAllowance(
    sourceChain,
    sourceAsset,
    transferAmountParsed || undefined,
    sourceIsNative
  )

  const approveButtonNeeded = isEVMChain(sourceChain) && !sufficientAllowance
  const [allowanceError, setAllowanceError] = useState('')

  const approveExactAmount = useMemo(() => {
    return () => {
      setAllowanceError('')
      approveAmount(BigInt(transferAmountParsed)).then(
        () => {
          setAllowanceError('')
        },
        (error) => setAllowanceError(t('Failed to approve the token transfer.'))
      )
    }
  }, [approveAmount, transferAmountParsed, t])

  const { isReady, statusMessage, walletAddress } = useIsWalletReady(sourceChain)
  const isWrongWallet = sourceWalletAddress && walletAddress && sourceWalletAddress !== walletAddress
  const { handleClick, disabled } = useHandleTransfer()
  const isSending = useSelector(selectTransferIsSending)

  const handleTransferClick = useCallback(() => {
    handleClick()
    onNext()
  }, [handleClick, onNext])

  const isDisabled = !isReady || isWrongWallet || disabled || isAllowanceFetching || isApproveProcessing

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h1 style={{ margin: 0 }}>Review</h1>
      </div>

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

      {(statusMessage || allowanceError) && <WarningBox>{statusMessage || allowanceError}</WarningBox>}

      <BridgeWidgetButton onClick={onBack} variant="outlined">Back</BridgeWidgetButton>
      
      {approveButtonNeeded ? (
        <BridgeWidgetButton disabled={isDisabled} onClick={approveExactAmount} isLoading={isApproveProcessing}>
          {t('approveTokens', { count: tokensAmount, symbol: sourceParsedTokenAccount?.symbol || '' })}
        </BridgeWidgetButton>
      ) : isSending ? (
        <BridgeWidgetButton onClick={onNext}>View current transfer progress</BridgeWidgetButton>
      ) : (
        <BridgeWidgetButton disabled={isDisabled} onClick={handleTransferClick} tone="primaryNext">
          {t('Transfer')}
        </BridgeWidgetButton>
      )}
    </>
  )
}

export default ReviewStep
