import { CHAIN_ID_ALEPHIUM, isEVMChain, waitAlphTxConfirmed } from '@alephium/wormhole-sdk'
import { Alert } from '@mui/lab'
import { Typography, makeStyles } from '@mui/material'
import { useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHandleAttest } from '../../hooks/useHandleAttest'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import {
  selectAttestAttestTx,
  selectAttestIsAlphPoolCreated,
  selectAttestIsSendComplete,
  selectAttestSignedVAAHex,
  selectAttestSourceAsset,
  selectAttestSourceChain
} from '../../store/selectors'
import TransactionProgress from '../TransactionProgress'
import WaitingForWalletMessage from './WaitingForWalletMessage'
import { ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL } from '../../utils/consts'
import { createLocalTokenPool } from '../../utils/alephium'
import { useWallet as useAlephiumWallet } from '@alephium/web3-react'
import { useSnackbar } from 'notistack'
import { setIsAlphPoolCreated, setStep } from '../../store/attestSlice'
import { useTranslation } from 'react-i18next'
import BridgeWidgetButton from '../BridgeWidget/BridgeWidgetButton'
import { useEthereumProvider } from '../../contexts/EthereumProviderContext'
import ConnectWalletButton from '../BridgeWidget/ConnectWalletButton'

const useStyles = makeStyles((theme) => ({
  statusMessage: {
    marginTop: theme.spacing(1),
    textAlign: 'center'
  }
}))

interface CreateLocalTokenPoolProps {
  localTokenId: string
}

const CreateLocalTokenPool = ({ localTokenId }: CreateLocalTokenPoolProps) => {
  const { t } = useTranslation()
  const alephiumWallet = useAlephiumWallet()
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  const signedVAAHex = useSelector(selectAttestSignedVAAHex)
  const isAlphPoolCreated = useSelector(selectAttestIsAlphPoolCreated)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>()
  const classes = useStyles()
  const onClick = useCallback(async () => {
    if (signedVAAHex !== undefined && alephiumWallet?.nodeProvider !== undefined) {
      try {
        setIsSending(true)
        const createLocalTokenPoolTxId = await createLocalTokenPool(
          alephiumWallet.signer,
          alephiumWallet.nodeProvider,
          alephiumWallet.account.address,
          localTokenId,
          Buffer.from(signedVAAHex, 'hex')
        )
        if (createLocalTokenPoolTxId !== undefined) {
          await waitAlphTxConfirmed(alephiumWallet.nodeProvider, createLocalTokenPoolTxId, 1)
          enqueueSnackbar(null, {
            content: <Alert severity="success">{t('Transaction confirmed')}</Alert>
          })
        } else {
          enqueueSnackbar(null, {
            content: <Alert severity="info">{t('Local token pool already exists')}</Alert>
          })
        }

        dispatch(setStep(3))
        dispatch(setIsAlphPoolCreated(true))
      } catch (error) {
        setError(`${error}`)
      }

      setIsSending(false)
    }
  }, [alephiumWallet, signedVAAHex, enqueueSnackbar, localTokenId, dispatch, t])
  const isReady = signedVAAHex !== undefined && alephiumWallet !== undefined && !isSending && !isAlphPoolCreated

  return (
    <>
      <BridgeWidgetButton short disabled={!isReady} onClick={onClick} isLoading={isSending} style={{ marginTop: 10 }}>
        {isSending ? `${t('Waiting for transaction confirmation')}...` : t('Create Local Token Pool')}
      </BridgeWidgetButton>
      {error ? (
        <Typography variant="body2" color="error" className={classes.statusMessage}>
          {error}
        </Typography>
      ) : null}
    </>
  )
}

const Send = () => {
  const { t } = useTranslation()
  const { handleClick: handleAttestClick, disabled: isAttestDisabled, showLoader: isAttestLoading } = useHandleAttest()
  const { signer } = useEthereumProvider()
  const alephiumWallet = useAlephiumWallet()
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)
  const attestTx = useSelector(selectAttestAttestTx)
  const isSendComplete = useSelector(selectAttestIsSendComplete)
  const { isReady, statusMessage: walletErrorMessage } = useIsWalletReady(sourceChain)
  const classes = useStyles()

  const isEvmChain = isEVMChain(sourceChain)
  const isAlephiumChain = sourceChain === CHAIN_ID_ALEPHIUM
  const isAlephiumConnected = alephiumWallet?.connectionStatus === 'connected' && !!alephiumWallet?.account?.address
  const isEvmConnected = isEvmChain && !!signer
  const isWalletConnected = isEvmChain ? isEvmConnected : isAlephiumChain ? isAlephiumConnected : isReady

  return (
    <>
      {!isWalletConnected ? (
        <ConnectWalletButton chainId={sourceChain} short disabled={!isEvmChain && !isAlephiumChain}>
          {t('Connect wallet')}
        </ConnectWalletButton>
      ) : (
        <BridgeWidgetButton
          short
          disabled={!isReady || isAttestDisabled}
          onClick={handleAttestClick}
          isLoading={isAttestLoading}
        >
          {t('Attest')}
        </BridgeWidgetButton>
      )}

      {isWalletConnected && walletErrorMessage ? (
        <Typography variant="body2" color="error" className={classes.statusMessage}>
          {walletErrorMessage}
        </Typography>
      ) : null}

      <WaitingForWalletMessage />

      <TransactionProgress
        chainId={sourceChain}
        tx={attestTx}
        isSendComplete={isSendComplete}
        consistencyLevel={isAlephiumChain ? ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL : undefined}
      />

      {isAlephiumChain && <CreateLocalTokenPool localTokenId={sourceAsset} />}
    </>
  )
}

export default Send
