import { CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH, CHAIN_ID_SOLANA } from '@alephium/wormhole-sdk'
import { getAddress } from '@ethersproject/address'
import { Button, makeStyles, Typography } from '@material-ui/core'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import {
  selectTransferShouldLockFields,
  selectTransferSourceAssetInfoWrapper,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetAssetWrapper,
  selectTransferTargetChain,
  selectTransferTargetError
} from '../../store/selectors'
import { setSourceChain, setTargetChain } from '../../store/transferSlice'
import { BSC_MIGRATION_ASSET_MAP, CHAINS, CHAINS_BY_ID, ETH_MIGRATION_ASSET_MAP } from '../../utils/consts'
import LowBalanceWarning from '../LowBalanceWarning'
import SourceAssetWarning from '../Transfer/SourceAssetWarning'
import ChainWarningMessage from '../ChainWarningMessage'
import { useTranslation } from 'react-i18next'
import { TokenSelector2 } from './SourceTokenSelector2'
import ChainSelect2 from './ChainSelect2'
import ChainSelectArrow2 from './ChainSelectArrow2'
import useSyncTargetAddress from '../../hooks/useSyncTargetAddress'
import useGetTargetParsedTokenAccounts from '../../hooks/useGetTargetParsedTokenAccounts'
import MainActionButton from './MainActionButton'
import WarningBox from './WarningBox'
import RegisterNowButton2 from './RegisterNowButton2'
import { GRAY, useWidgetStyles } from './styles'
import { COLORS } from '../../muiTheme'
import clsx from 'clsx'
import Divider from './Divider'

// Copied from Source.tsx

interface EnterDataStepProps {
  onNext?: () => void
}

const EnterDataStep = ({ onNext }: EnterDataStepProps) => {
  const { t } = useTranslation()
  const classes = useStyles()
  const widgetClasses = useWidgetStyles()
  const dispatch = useDispatch()
  const history = useHistory()
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const targetChainOptions = useMemo(
    () => CHAINS.filter((c) => (sourceChain !== CHAIN_ID_ALEPHIUM ? c.id === CHAIN_ID_ALEPHIUM : c.id !== sourceChain)),
    [sourceChain]
  )
  const parsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)
  const { error: targetAssetError, data } = useSelector(selectTransferTargetAssetWrapper)
  const targetChainInfo = useMemo(() => CHAINS_BY_ID[targetChain], [targetChain])
  const { error: fetchSourceAssetInfoError } = useSelector(selectTransferSourceAssetInfoWrapper)
  const isEthereumMigration =
    sourceChain === CHAIN_ID_ETH &&
    !!parsedTokenAccount &&
    !!ETH_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey))
  const isBscMigration =
    sourceChain === CHAIN_ID_BSC &&
    !!parsedTokenAccount &&
    !!BSC_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey))
  const isMigrationAsset = isEthereumMigration || isBscMigration
  const shouldLockFields = useSelector(selectTransferShouldLockFields)
  const { statusMessage, isReady: isTargetChainReady } = useIsWalletReady(targetChain)
  const { isReady: isSourceChainReady } = useIsWalletReady(sourceChain)
  const targetError = useSelector(selectTransferTargetError)
  const [showAmountInput, setShowAmountInput] = useState(false)

  useGetTargetParsedTokenAccounts()
  useSyncTargetAddress(!shouldLockFields)

  const handleMigrationClick = useCallback(() => {
    if (sourceChain === CHAIN_ID_SOLANA) {
      history.push(`/migrate/Solana/${parsedTokenAccount?.mintKey}/${parsedTokenAccount?.publicKey}`)
    } else if (sourceChain === CHAIN_ID_ETH) {
      history.push(`/migrate/Ethereum/${parsedTokenAccount?.mintKey}`)
    } else if (sourceChain === CHAIN_ID_BSC) {
      history.push(`/migrate/BinanceSmartChain/${parsedTokenAccount?.mintKey}`)
    }
  }, [history, parsedTokenAccount, sourceChain])

  const handleSourceChange = useCallback(
    (event: any) => {
      dispatch(setSourceChain(event.target.value))
    },
    [dispatch]
  )

  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value))
    },
    [dispatch]
  )

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

  useEffect(() => {
    if (!isTargetChainReady || !isSourceChainReady) {
      setShowAmountInput(false)
      return
    }

    const timeout = window.setTimeout(() => setShowAmountInput(true), 600)

    return () => window.clearTimeout(timeout)
  }, [isTargetChainReady, isSourceChainReady])

  return (
    <>
      <div className={clsx(widgetClasses.grayRoundedBox, classes.chainSelectWrapper)} style={{ borderColor: isSourceChainReady && isTargetChainReady ? 'transparent' : COLORS.whiteWithTransparency }}>
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="From"
            select
            variant="outlined"
            value={sourceChain}
            onChange={handleSourceChange}
            disabled={shouldLockFields}
            chains={CHAINS}
          />
        </div>
        <Divider />
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="To"
            variant="outlined"
            select
            value={targetChain}
            onChange={handleTargetChange}
            disabled={shouldLockFields}
            chains={targetChainOptions}
          />
        </div>
        <div className={classes.chainSelectArrow}>
          <ChainSelectArrow2
            onClick={() => {
              dispatch(setSourceChain(targetChain))
            }}
            disabled={shouldLockFields}
          />
        </div>
      </div>

      <AnimatePresence>
        {showAmountInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto'}}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20}}
          >
            <TokenSelector2 disabled={shouldLockFields} />
          </motion.div>
        )}
      </AnimatePresence>

      {isMigrationAsset ? (
        <Button variant="contained" color="primary" fullWidth onClick={handleMigrationClick}>
          {t('Go to Migration Page')}
        </Button>
      ) : (
        <>
          <LowBalanceWarning chainId={sourceChain} />
          <SourceAssetWarning sourceChain={sourceChain} sourceAsset={parsedTokenAccount?.mintKey} />
          <ChainWarningMessage chainId={sourceChain} />
          <ChainWarningMessage chainId={targetChain} />

          {!statusMessage && data && !data.doesExist && (
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
                  <Typography style={{ fontWeight: 600 }}>
                    {parsedTokenAccount?.symbol} is not registered on {targetChainInfo.name}.
                  </Typography>
                  <Typography style={{ color: GRAY, fontSize: '14px' }}>Please register it now.</Typography>
                </div>

                <RegisterNowButton2 />
              </div>
            </WarningBox>
          )}
        </>
      )}

      <MainActionButton onNext={onNext} />
    </>
  )
}

export default EnterDataStep

const useStyles = makeStyles((theme) => ({
  chainSelectWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    gap: '24px'
  },
  chainSelectContainer: {
    flexBasis: '100%',
    width: '100%'
  },
  chainSelectArrow: {
    position: 'absolute',
    top: 'calc(50% - 15px)',
    transform: 'rotate(90deg)'
  }
}))
