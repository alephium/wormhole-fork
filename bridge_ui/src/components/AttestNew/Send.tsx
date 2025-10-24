import { CHAIN_ID_ALEPHIUM, isEVMChain, waitAlphTxConfirmed } from '@alephium/wormhole-sdk'
import { Alert } from '@material-ui/lab'
import { Typography, makeStyles } from '@material-ui/core'
import { useCallback, useMemo, useState } from 'react'
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
import { AlephiumConnectButton, useWallet as useAlephiumWallet } from '@alephium/web3-react'
import { useSnackbar } from 'notistack'
import { setIsAlphPoolCreated, setStep } from '../../store/attestSlice'
import { useTranslation } from 'react-i18next'
import BridgeWidgetButton from '../BridgeWidget/BridgeWidgetButton'
import { useEthereumProvider } from '../../contexts/EthereumProviderContext'
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'

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
  const { handleClick, disabled, showLoader } = useHandleAttest()
  const { signer } = useEthereumProvider()
  const alephiumWallet = useAlephiumWallet()
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)
  const attestTx = useSelector(selectAttestAttestTx)
  const isSendComplete = useSelector(selectAttestIsSendComplete)
  const { isReady, statusMessage } = useIsWalletReady(sourceChain)
  const classes = useStyles()
  const [isEvmDialogOpen, setIsEvmDialogOpen] = useState(false)

  const isAlephiumConnected = alephiumWallet?.connectionStatus === 'connected' && !!alephiumWallet?.account?.address
  const isEvmConnected = isEVMChain(sourceChain) ? !!signer : false

  const isWalletConnected = useMemo(() => {
    if (isEVMChain(sourceChain)) {
      return isEvmConnected
    }
    if (sourceChain === CHAIN_ID_ALEPHIUM) {
      return isAlephiumConnected
    }
    return isReady
  }, [isAlephiumConnected, isEvmConnected, isReady, sourceChain])

  const shouldShowConnectButton = !isWalletConnected

  const isConnectActionAvailable = useMemo(() => {
    if (!shouldShowConnectButton) return true
    if (isEVMChain(sourceChain)) return true
    if (sourceChain === CHAIN_ID_ALEPHIUM) return true
    return false
  }, [shouldShowConnectButton, sourceChain])

  const handleConnectClick = useCallback(() => {
    if (!shouldShowConnectButton) return

    if (isEVMChain(sourceChain)) {
      setIsEvmDialogOpen(true)
      return
    }
  }, [shouldShowConnectButton, sourceChain])

  return (
    <>
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show }) => (
          <BridgeWidgetButton
            short
            disabled={shouldShowConnectButton ? !isConnectActionAvailable : !isReady || disabled}
            onClick={
              shouldShowConnectButton ? (sourceChain === CHAIN_ID_ALEPHIUM ? show : handleConnectClick) : handleClick
            }
            isLoading={shouldShowConnectButton ? false : showLoader}
          >
            {shouldShowConnectButton ? t('Connect wallet') : t('Attest')}
          </BridgeWidgetButton>
        )}
      </AlephiumConnectButton.Custom>
      {!shouldShowConnectButton && statusMessage ? (
        <Typography variant="body2" color="error" className={classes.statusMessage}>
          {statusMessage}
        </Typography>
      ) : null}
      <WaitingForWalletMessage />
      <TransactionProgress
        chainId={sourceChain}
        tx={attestTx}
        isSendComplete={isSendComplete}
        consistencyLevel={sourceChain === CHAIN_ID_ALEPHIUM ? ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL : undefined}
      />
      {sourceChain === CHAIN_ID_ALEPHIUM && <CreateLocalTokenPool localTokenId={sourceAsset} />}
      {isEVMChain(sourceChain) && (
        <EvmConnectWalletDialog
          isOpen={isEvmDialogOpen}
          onClose={() => setIsEvmDialogOpen(false)}
          chainId={sourceChain}
        />
      )}
    </>
  )
}

export default Send
