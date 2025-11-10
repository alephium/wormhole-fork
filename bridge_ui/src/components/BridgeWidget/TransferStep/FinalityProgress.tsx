import { useDispatch, useSelector } from 'react-redux'
import {
  selectFinalityProgressInitialRemainingBlocks,
  selectFinalityProgressInitialRemainingSeconds,
  selectTransferIsBlockFinalized,
  selectTransferIsSendComplete,
  selectTransferSourceChain,
  selectTransferTransferTx
} from '../../../store/selectors'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import { useEffect, useState } from 'react'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import {
  setFinalityProgressInitialRemainingBlocks,
  setFinalityProgressInitialRemainingSeconds,
  setIsBlockFinalized
} from '../../../store/transferSlice'
import { CheckCircleOutlineRounded } from '@mui/icons-material'
import { CircularProgress, LinearProgress, Typography } from '@mui/material'
import { styled } from '@mui/material/styles';
import { CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, isEVMChain } from '@alephium/wormhole-sdk'
import { ALEPHIUM_BRIDGE_GROUP_INDEX, ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL, CLUSTER } from '../../../utils/consts'
import {
  DefaultEVMChainConfirmations,
  EpochDuration,
  getEVMCurrentBlockNumber,
  getEvmJsonRpcProvider
} from '../../../utils/evm'
import { useEthereumProvider } from '../../../contexts/EthereumProviderContext'
import { useWallet } from '@alephium/web3-react'
import { ethers } from 'ethers'
import { AlephiumBlockTime } from '../../../utils/alephium'
import { COLORS } from '../../../muiTheme'
import useFetchAvgBlockTime from '../useFetchAvgBlockTime'
import { secondsToTime } from '../bridgeUtils'

const FinalityProgress = ({ isActive }: { isActive: boolean }) => {
  const { classes } = useWidgetStyles()
  const tx = useSelector(selectTransferTransferTx)
  const sourceChain = useSelector(selectTransferSourceChain)
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const signedVAA = useTransferSignedVAA()
  const dispatch = useDispatch()

  const remainingBlocksForFinality = useRemainingBlocksForFinality()
  const avgAlphBlockTime = useFetchAvgBlockTime()
  const remainingSecondsForAlphFinality =
    avgAlphBlockTime && remainingBlocksForFinality ? remainingBlocksForFinality * (avgAlphBlockTime / 1000) : undefined

  const initialRemainingBlocks = useSelector(selectFinalityProgressInitialRemainingBlocks)
  const initialRemainingSeconds = useSelector(selectFinalityProgressInitialRemainingSeconds)
  const alphTxConfirmsAt = tx?.blockTimestamp
    ? tx.blockTimestamp + ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL * AlephiumBlockTime
    : undefined

  useEffect(() => {
    if (initialRemainingBlocks || !remainingBlocksForFinality) return

    dispatch(setFinalityProgressInitialRemainingBlocks(remainingBlocksForFinality))
  }, [dispatch, initialRemainingBlocks, remainingBlocksForFinality])

  const [alphTxConfirmed, setAlphTxConfirmed] = useState<boolean>(!!signedVAA)
  const [remainingSeconds, setRemainingSeconds] = useState<number>()

  const showProgress = tx && remainingBlocksForFinality !== undefined && initialRemainingBlocks !== undefined

  const isCompleted =
    !!signedVAA ||
    ((remainingBlocksForFinality === 0 || isBlockFinalized) && (sourceChain !== CHAIN_ID_ALEPHIUM || alphTxConfirmed))

  useEffect(() => {
    if (isCompleted) {
      dispatch(setIsBlockFinalized(true))
    }
  }, [dispatch, isCompleted])

  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    if (isActive && showProgress && remainingBlocksForFinality >= 0) {
      setProgress(100 - (remainingBlocksForFinality / initialRemainingBlocks) * 100)
    }
  }, [isActive, showProgress, remainingBlocksForFinality, initialRemainingBlocks])

  useEffect(() => {
    if (
      sourceChain === CHAIN_ID_ALEPHIUM &&
      isActive &&
      showProgress &&
      remainingBlocksForFinality === 0 &&
      alphTxConfirmsAt
    ) {
      dispatch(setFinalityProgressInitialRemainingSeconds((alphTxConfirmsAt - Date.now()) / 1000))
    }
  }, [isActive, showProgress, remainingBlocksForFinality, alphTxConfirmsAt, sourceChain, dispatch])

  useEffect(() => {
    if (remainingSeconds !== undefined && remainingSeconds >= 0 && initialRemainingSeconds) {
      const newProgress = 100 - (remainingSeconds / initialRemainingSeconds) * 100

      setProgress(newProgress)

      if (newProgress >= 100) {
        setAlphTxConfirmed(true)
      }
    }
  }, [initialRemainingSeconds, remainingSeconds])

  useEffect(() => {
    if (sourceChain === CHAIN_ID_ALEPHIUM && initialRemainingSeconds) {
      const interval = setInterval(() => {
        const now = Date.now()
        const remaining = alphTxConfirmsAt ? Math.max(0, alphTxConfirmsAt - now) / 1000 : 0

        setRemainingSeconds(remaining)

        if (remaining <= 0) {
          clearInterval(interval)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [alphTxConfirmsAt, initialRemainingSeconds, sourceChain])

  // Fake progress bar
  useEffect(() => {
    if (!isActive || !showProgress || isCompleted) return

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return prev
        }

        const newProgress = prev + 0.05

        return newProgress
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, isCompleted, showProgress])

  return (
    <div style={{ marginTop: '10px' }}>
      <div className={classes.bridgingProgressRow} style={{ color: isActive ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {isCompleted ? (
            <CheckCircleOutlineRounded style={{ color: GREEN }} fontSize="small" />
          ) : (
            <CircularProgress size={18} style={{ color: COLORS.nearWhite }} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
          {isCompleted ? (
            <Typography>Block has been finalized!</Typography>
          ) : isActive && showProgress ? (
            remainingBlocksForFinality > 0 ? (
              <div className={classes.spaceBetween}>
                <Typography>Remaining blocks for finality:</Typography>
                <Typography style={{ fontWeight: 600 }}>{remainingBlocksForFinality}</Typography>
              </div>
            ) : (
              <div className={classes.spaceBetween}>
                <Typography>Waiting for confirmations...</Typography>
                {remainingSeconds && (
                  <Typography style={{ fontWeight: 600 }}>{secondsToTime(remainingSeconds)}</Typography>
                )}
              </div>
            )
          ) : (
            <div className={classes.spaceBetween}>
              <Typography>Waiting for block finality...</Typography>
            </div>
          )}
          {!isCompleted && isActive && showProgress && (
            <div>
              <BorderLinearProgress value={progress} variant="determinate" style={{ marginBottom: 5 }} />
              {sourceChain === CHAIN_ID_ETH && (
                <div style={{ color: GRAY, textAlign: 'right' }}>Time for a coffee&nbsp; ☕️</div>
              )}
              {sourceChain === CHAIN_ID_ALEPHIUM && remainingSecondsForAlphFinality && (
                <div style={{ color: GRAY, textAlign: 'right' }}>
                  {secondsToTime(remainingSecondsForAlphFinality, true)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default FinalityProgress

const BorderLinearProgress = styled(LinearProgress)(() => ({
  height: 8,
  borderRadius: 5,
  [`&.MuiLinearProgress-colorPrimary`]: {
    backgroundColor: COLORS.whiteWithTransparency
  },
  [`& .MuiLinearProgress-barColorPrimary`]: {
    borderRadius: 5,
    backgroundColor: COLORS.blue
  }
}))

const useRemainingBlocksForFinality = () => {
  const currentBlockHeight = useFetchCurrentBlockNumber()
  const sourceChain = useSelector(selectTransferSourceChain)
  const tx = useSelector(selectTransferTransferTx)

  const isEthereum = sourceChain === CHAIN_ID_ETH && CLUSTER !== 'devnet'
  const isAlephium = sourceChain === CHAIN_ID_ALEPHIUM

  if (!tx || !currentBlockHeight) return undefined

  const remainingBlocksUntilTxBlock = tx.blockHeight - currentBlockHeight
  const remainingBlocksForFinality = isEthereum
    ? remainingBlocksUntilTxBlock
    : isAlephium
    ? remainingBlocksUntilTxBlock + ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
    : remainingBlocksUntilTxBlock + DefaultEVMChainConfirmations

  return remainingBlocksForFinality > 0 ? remainingBlocksForFinality : 0
}

const useFetchCurrentBlockNumber = () => {
  const { provider } = useEthereumProvider()
  const alphWallet = useWallet()
  const [currentBlock, setCurrentBlock] = useState<number>()
  const [evmProvider, setEvmProvider] = useState<ethers.providers.Provider | undefined>(provider)
  const [lastBlockUpdatedTs, setLastBlockUpdatedTs] = useState(Date.now())

  const isSendComplete = useSelector(selectTransferIsSendComplete)
  const tx = useSelector(selectTransferTransferTx)
  const sourceChain = useSelector(selectTransferSourceChain)

  useEffect(() => {
    if (isSendComplete || !tx) return

    if (isEVMChain(sourceChain) && evmProvider) {
      let cancelled = false
      ;(async () => {
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 3000))
          try {
            const newBlock = await getEVMCurrentBlockNumber(evmProvider, sourceChain)

            if (!cancelled) {
              setCurrentBlock((prev) => {
                const now = Date.now()
                if (prev === newBlock && now - lastBlockUpdatedTs > EpochDuration && evmProvider === provider) {
                  setEvmProvider(getEvmJsonRpcProvider(sourceChain))
                } else if (prev !== newBlock) {
                  setLastBlockUpdatedTs(now)
                }
                return newBlock
              })
            }
          } catch (e) {
            console.error(e)
          }
        }
      })()

      return () => {
        cancelled = true
      }
    }

    if (sourceChain === CHAIN_ID_ALEPHIUM && alphWallet?.nodeProvider !== undefined) {
      let cancelled = false
      ;(async (nodeProvider) => {
        while (!cancelled) {
          const timeout = CLUSTER === 'devnet' ? 1000 : 10000
          await new Promise((resolve) => setTimeout(resolve, timeout))
          try {
            const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo({
              fromGroup: ALEPHIUM_BRIDGE_GROUP_INDEX,
              toGroup: ALEPHIUM_BRIDGE_GROUP_INDEX
            })
            if (!cancelled) {
              setCurrentBlock(chainInfo.currentHeight)
            }
          } catch (e) {
            console.error(e)
          }
        }
      })(alphWallet.nodeProvider)
      return () => {
        cancelled = true
      }
    }
  }, [isSendComplete, sourceChain, provider, alphWallet, tx, lastBlockUpdatedTs, evmProvider])

  return currentBlock
}
