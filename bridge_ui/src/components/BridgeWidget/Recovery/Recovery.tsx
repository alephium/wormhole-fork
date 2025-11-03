import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  hexToUint8Array,
  isEVMChain,
  uint8ArrayToHex,
  TransferToken,
  TransferNFT,
  deserializeTransferTokenVAA,
  deserializeTransferNFTVAA
} from '@alephium/wormhole-sdk'
import { makeStyles, Typography } from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import axios from 'axios'
import { useSnackbar } from 'notistack'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useLocation } from 'react-router'
import { useEthereumProvider } from '../../../contexts/EthereumProviderContext'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import useRelayersAvailable, { Relayer } from '../../../hooks/useRelayersAvailable'
import { COLORS } from '../../../muiTheme'
import { setRecoveryVaa as setRecoveryNFTVaa } from '../../../store/nftSlice'
import { setBridgeWidgetPage, setBridgeWidgetStep, setRecoveryVaa } from '../../../store/transferSlice'
import { getAlphTxInfoByTxId } from '../../../utils/alephium'
import {
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  CHAINS,
  CHAINS_BY_ID,
  CHAINS_WITH_NFT_SUPPORT,
  RELAY_URL_EXTENSION,
  WORMHOLE_RPC_HOSTS
} from '../../../utils/consts'
import { getSignedVAAWithRetry } from '../../../utils/getSignedVAAWithRetry'
import parseError from '../../../utils/parseError'
import RelaySelector from '../../RelaySelector'
import { selectTransferSourceChain, selectTransferTransferTx } from '../../../store/selectors'
import { Wallet, useWallet } from '@alephium/web3-react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
import { GRAY, RED, useWidgetStyles } from '../styles'
import ChainSelect2 from '../ChainSelect2'
import BridgeWidgetButton from '../BridgeWidgetButton'
import ConnectWalletButton from '../ConnectWalletButton'
import WarningBox from '../WarningBox'
import useFetchAvgBlockTime from '../useFetchAvgBlockTime'
import { secondsToTime } from '../bridgeUtils'
import { evm } from '../../Recovery'

const useStyles = makeStyles((theme) => ({
  mainCard: {
    padding: '32px 32px 16px',
    backgroundColor: COLORS.whiteWithTransparency
  },
  advancedContainer: {
    padding: theme.spacing(2, 0)
  },
  relayAlert: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    '& > .MuiAlert-message': {
      width: '100%'
    }
  }
}))

async function alephium(wallet: Wallet, txId: string, enqueueSnackbar: any) {
  try {
    if (wallet.nodeProvider === undefined) {
      throw new Error(i18n.t('Wallet is not connected'))
    }
    const txInfo = await getAlphTxInfoByTxId(wallet.nodeProvider, txId)
    if (txInfo.confirmations < ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL) {
      throw new Error(
        `remaining-blocks-until-confirmation:${ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL - txInfo.confirmations}`
      )
    }
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      txInfo.targetChain,
      txInfo.sequence,
      WORMHOLE_RPC_HOSTS.length
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

function RelayerRecovery({
  parsedPayload,
  signedVaa,
  onClick
}: {
  parsedPayload: any
  signedVaa: string
  onClick: () => void
}) {
  const { t } = useTranslation()
  const classes = useStyles()
  const relayerInfo = useRelayersAvailable(true)
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null)
  const [isAttemptingToSchedule, setIsAttemptingToSchedule] = useState(false)
  const { enqueueSnackbar } = useSnackbar()

  const fee = (parsedPayload && parsedPayload.fee && parseInt(parsedPayload.fee)) || null
  //This check is probably more sophisticated in the future. Possibly a net call.
  const isEligible = fee && fee > 0 && relayerInfo?.data?.relayers?.length && relayerInfo?.data?.relayers?.length > 0

  const handleRelayerChange = useCallback(
    (relayer: Relayer | null) => {
      setSelectedRelayer(relayer)
    },
    [setSelectedRelayer]
  )

  const handleGo = useCallback(async () => {
    if (!(selectedRelayer && selectedRelayer.url)) {
      return
    }

    setIsAttemptingToSchedule(true)
    axios
      .get(
        selectedRelayer.url +
          RELAY_URL_EXTENSION +
          encodeURIComponent(Buffer.from(hexToUint8Array(signedVaa)).toString('base64'))
      )
      .then(
        () => {
          setIsAttemptingToSchedule(false)
          onClick()
        },
        (error) => {
          setIsAttemptingToSchedule(false)
          enqueueSnackbar(null, {
            content: (
              <Alert severity="error">
                {t('Relay request rejected.')} {t('Error')}: {error.message}
              </Alert>
            )
          })
        }
      )
      .catch((error) => {
        setIsAttemptingToSchedule(false)
        enqueueSnackbar(null, {
          content: (
            <Alert severity="error">
              {t('Relay request rejected.')} {t('Error')}: {error.message}
            </Alert>
          )
        })
      })
  }, [selectedRelayer, signedVaa, onClick, enqueueSnackbar, t])

  if (!isEligible) {
    return null
  }

  return (
    <Alert variant="outlined" severity="info" className={classes.relayAlert}>
      <Typography>{t('This transaction is eligible to be relayed')}</Typography>
      <RelaySelector selectedValue={selectedRelayer} onChange={handleRelayerChange} />
      <BridgeWidgetButton disabled={!selectedRelayer} onClick={handleGo} isLoading={isAttemptingToSchedule}>
        {t('Request Relay')}
      </BridgeWidgetButton>
    </Alert>
  )
}

const Recovery = () => {
  const { t } = useTranslation()
  const { push } = useHistory()
  const { enqueueSnackbar } = useSnackbar()
  const dispatch = useDispatch()
  const { provider } = useEthereumProvider()
  const isNFT = false
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTx = useSelector(selectTransferTransferTx)
  const [recoverySourceChain, setRecoverySourceChain] = useState<ChainId>(CHAIN_ID_ALEPHIUM)
  const [recoverySourceTx, setRecoverySourceTx] = useState('')
  const [recoverySourceTxIsLoading, setRecoverySourceTxIsLoading] = useState(false)
  const [recoverySourceTxError, setRecoverySourceTxError] = useState('')
  const [recoverySignedVAA, setRecoverySignedVAA] = useState('')
  const [recoveryParsedVAA, setRecoveryParsedVAA] = useState<any>(null)
  const { isReady, statusMessage } = useIsWalletReady(recoverySourceChain)
  const walletConnectError = isEVMChain(recoverySourceChain) && !isReady ? statusMessage : ''
  const parsedPayload = useMemo(() => {
    try {
      return recoveryParsedVAA?.body.payload ? recoveryParsedVAA.body.payload : null
    } catch (e) {
      console.error(e)
      return null
    }
  }, [recoveryParsedVAA])

  const { search } = useLocation()
  const query = useMemo(() => new URLSearchParams(search), [search])
  const pathSourceChain = query.get('sourceChain')
  const pathSourceTransaction = query.get('transactionId')
  const alphWallet = useWallet()

  //This effect initializes the state based on the path params.
  useEffect(() => {
    if (!pathSourceChain) {
      setRecoverySourceChain(transferSourceChain)
    }
    if (!pathSourceTransaction && transferTx !== undefined) {
      setRecoverySourceTx(transferTx.id)
    }
    if (!pathSourceChain && !pathSourceTransaction) {
      return
    }
    try {
      const sourceChain: ChainId = CHAINS_BY_ID[parseFloat(pathSourceChain || '') as ChainId]?.id

      if (sourceChain) {
        setRecoverySourceChain(sourceChain)
      }
      if (pathSourceTransaction) {
        setRecoverySourceTx(pathSourceTransaction)
      }
    } catch (e) {
      console.error(e)
      console.error('Invalid path params specified.')
    }
  }, [pathSourceChain, pathSourceTransaction, transferSourceChain, transferTx])

  useEffect(() => {
    if (recoverySourceTx && (!isEVMChain(recoverySourceChain) || isReady)) {
      let cancelled = false
      if (isEVMChain(recoverySourceChain) && provider) {
        setRecoverySourceTxError('')
        setRecoverySourceTxIsLoading(true)
        ;(async () => {
          const { vaa, error } = await evm(provider, recoverySourceTx, enqueueSnackbar, recoverySourceChain, isNFT)
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false)
            if (vaa) {
              setRecoverySignedVAA(vaa)
            }
            if (error) {
              setRecoverySourceTxError(error)
            }
          }
        })()
      } else if (recoverySourceChain === CHAIN_ID_ALEPHIUM && isReady) {
        setRecoverySourceTxError('')
        setRecoverySourceTxIsLoading(true)
        ;(async (nodeProvider) => {
          const { vaa, error } = await alephium(alphWallet, recoverySourceTx, enqueueSnackbar)
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false)
            if (vaa) {
              setRecoverySignedVAA(vaa)
            }
            if (error) {
              setRecoverySourceTxError(error)
            }
          }
        })(alphWallet.nodeProvider)
      }
      return () => {
        cancelled = true
      }
    }
  }, [recoverySourceChain, recoverySourceTx, provider, enqueueSnackbar, isNFT, isReady, alphWallet])
  const handleSourceChainChange = useCallback((event: any) => {
    setRecoverySourceTx('')
    setRecoverySourceChain(event.target.value)
  }, [])
  const handleSourceTxChange = useCallback((event: any) => {
    setRecoverySourceTx(event.target.value.trim())
  }, [])
  useEffect(() => {
    let cancelled = false
    if (recoverySignedVAA) {
      ;(async () => {
        try {
          const bytes = hexToUint8Array(recoverySignedVAA)
          const parsedVAA = isNFT ? deserializeTransferNFTVAA(bytes) : deserializeTransferTokenVAA(bytes)
          if (!cancelled) {
            setRecoveryParsedVAA(parsedVAA)
          }
        } catch (e) {
          console.log(e)
          if (!cancelled) {
            setRecoveryParsedVAA(null)
          }
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [recoverySignedVAA, isNFT])
  const parsedVAATargetChain = recoveryParsedVAA?.body.targetChainId
  const parsedVAAEmitterChain = recoveryParsedVAA?.body.emitterChainId
  const enableRecovery = recoverySignedVAA && parsedVAATargetChain

  const handleRecoverClickBase = useCallback(
    (useRelayer: boolean) => {
      if (enableRecovery && recoverySignedVAA && parsedVAATargetChain && parsedPayload) {
        // TODO: make recovery reducer
        if (isNFT) {
          const payload = parsedPayload as TransferNFT
          dispatch(
            setRecoveryNFTVaa({
              vaa: recoverySignedVAA,
              parsedPayload: {
                targetChain: parsedVAATargetChain,
                targetAddress: uint8ArrayToHex(payload.targetAddress),
                originChain: payload.originChain,
                originAddress: uint8ArrayToHex(payload.originAddress)
              }
            })
          )
          push('/nft')
        } else {
          const payload = parsedPayload as TransferToken
          dispatch(
            setRecoveryVaa({
              vaa: recoverySignedVAA,
              useRelayer,
              parsedPayload: {
                sourceTxId: recoverySourceTx,
                sourceChain: parsedVAAEmitterChain,
                targetChain: parsedVAATargetChain,
                targetAddress: uint8ArrayToHex(payload.targetAddress),
                originChain: payload.originChain,
                originAddress: uint8ArrayToHex(payload.originAddress),
                amount: payload.amount.toString()
              }
            })
          )

          dispatch(setBridgeWidgetPage('bridge'))
          dispatch(setBridgeWidgetStep(2))
        }
      }
    },
    [
      dispatch,
      enableRecovery,
      recoverySourceTx,
      recoverySignedVAA,
      parsedVAATargetChain,
      parsedVAAEmitterChain,
      parsedPayload,
      isNFT,
      push
    ]
  )

  const handleRecoverClick = useCallback(() => {
    handleRecoverClickBase(false)
  }, [handleRecoverClickBase])

  const handleRecoverWithRelayerClick = useCallback(() => {
    handleRecoverClickBase(true)
  }, [handleRecoverClickBase])

  const widgetClasses = useWidgetStyles()
  const isSourceChainReady = useIsWalletReady(recoverySourceChain)
  const error = recoverySourceTxError || walletConnectError
  const isUnconfirmedTxError = error.startsWith('remaining-blocks-until-confirmation:')
  const remainingBlocksUntilConfirmation = isUnconfirmedTxError ? parseInt(error.split(':')[1]) : undefined
  const inputRef = useRef<HTMLInputElement | null>(null)
  const avgAlphBlockTime = useFetchAvgBlockTime()
  const remainingSecondsUntilConfirmation = remainingBlocksUntilConfirmation
    ? remainingBlocksUntilConfirmation * (avgAlphBlockTime / 1000)
    : undefined

  useLayoutEffect(() => {
    if (!isReady || typeof window === 'undefined') {
      return
    }

    const input = inputRef.current

    if (!input) return

    const frame = window.requestAnimationFrame(() => input.focus({ preventScroll: true }))

    return () => window.cancelAnimationFrame(frame)
  }, [isReady])

  return (
    <>
      <div
        className={widgetClasses.grayRoundedBox}
        style={{ borderColor: isSourceChainReady.isReady ? 'transparent' : COLORS.whiteWithTransparency }}
      >
        <div className={widgetClasses.chainSelectContainer}>
          <ChainSelect2
            label="From"
            select
            variant="outlined"
            value={recoverySourceChain}
            onChange={handleSourceChainChange}
            disabled={!!recoverySignedVAA}
            chains={isNFT ? CHAINS_WITH_NFT_SUPPORT : CHAINS}
          />
        </div>
      </div>
      <div className={widgetClasses.inputFieldContainer}>
        <div className={widgetClasses.inputFieldContainerInner}>
          <input
            ref={inputRef}
            id="transaction-id"
            name="transaction-id"
            className={widgetClasses.inputField}
            placeholder="Paste transaction ID here"
            disabled={!!recoverySignedVAA || recoverySourceTxIsLoading || !!walletConnectError}
            value={recoverySourceTx}
            onChange={handleSourceTxChange}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            autoFocus
          />
        </div>
      </div>

      {isUnconfirmedTxError && remainingSecondsUntilConfirmation && (
        <WarningBox>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              width: '100%'
            }}
          >
            <div>
              <Typography style={{ fontWeight: 600 }}>The transaction is still awaiting confirmation.</Typography>
              <Typography style={{ color: GRAY, fontSize: '14px' }}>
                Try again in {secondsToTime(remainingSecondsUntilConfirmation, true)}.
              </Typography>
            </div>

            <BridgeWidgetButton
              variant="outlined"
              size="small"
              style={{ width: 'auto', boxShadow: 'none', padding: '0 20px' }}
              onClick={() => {
                setRecoverySourceTx('')
                setTimeout(() => {
                  setRecoverySourceTx(recoverySourceTx)
                }, 0)
              }}
            >
              Try again
            </BridgeWidgetButton>
          </div>
        </WarningBox>
      )}

      {error && !isUnconfirmedTxError && recoverySourceTx && <div style={{ color: RED }}>{error}</div>}

      <RelayerRecovery
        parsedPayload={parsedPayload}
        signedVaa={recoverySignedVAA}
        onClick={handleRecoverWithRelayerClick}
      />

      {isReady ? (
        <BridgeWidgetButton
          onClick={handleRecoverClick}
          disabled={!enableRecovery || !isReady}
          isLoading={recoverySourceTxIsLoading}
        >
          {t('Recover')}
        </BridgeWidgetButton>
      ) : (
        <ConnectWalletButton chainId={recoverySourceChain}>
          {`Connect ${CHAINS_BY_ID[recoverySourceChain]?.name ?? 'selected chain'} wallet`}
        </ConnectWalletButton>
      )}
    </>
  )
}

export default Recovery
