import { CHAIN_ID_BSC, CHAIN_ID_ETH, CHAIN_ID_SOLANA } from '@alephium/wormhole-sdk'
import { getAddress } from '@ethersproject/address'
import { Button, Typography } from '@mui/material'
import { AnimatePresence, motion } from 'framer-motion'

import { useCallback, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import {
  selectTransferShouldLockFields,
  selectTransferSourceAssetInfoWrapper,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetAssetWrapper,
  selectTransferTargetChain,
  selectTransferTargetError
} from '../../../store/selectors'
import { BSC_MIGRATION_ASSET_MAP, CHAINS_BY_ID, ETH_MIGRATION_ASSET_MAP } from '../../../utils/consts'
import LowBalanceWarning from '../../LowBalanceWarning'
import SourceAssetWarning from '../../Transfer/SourceAssetWarning'
import ChainWarningMessage from '../../ChainWarningMessage'
import { useTranslation } from 'react-i18next'
import { TokenSelector2 } from '../SourceTokenSelector2'
import useSyncTargetAddress from '../../../hooks/useSyncTargetAddress'
import useGetTargetParsedTokenAccounts from '../../../hooks/useGetTargetParsedTokenAccounts'
import MainActionButton from '../MainActionButton'
import WarningBox from '../WarningBox'
import RegisterNowButton2 from '../RegisterNowButton2'
import { GRAY } from '../styles'
import ChainSelectors from '../ChainSelectors'

// Copied from Source.tsx

interface EnterDataStepProps {
  onNext?: () => void
}

const EnterDataStep = ({ onNext }: EnterDataStepProps) => {
  const { t } = useTranslation()
  const history = useHistory()
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)

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
  const walletsReady = isSourceChainReady && isTargetChainReady

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

  return (
    <>
      <ChainSelectors />

      <AnimatePresence initial={false}>
        {walletsReady && (
          <motion.div
            initial={{ opacity: 0, height: 0, filter: 'blur(20px)' }}
            animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
            exit={{ opacity: 0, height: 0, filter: 'blur(20px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 23 }}
          >
            <TokenSelector2 key={sourceChain} disabled={shouldLockFields} />
          </motion.div>
        )}
      </AnimatePresence>

      {isMigrationAsset ? (
        <Button variant="contained" color="primary" fullWidth onClick={handleMigrationClick}>
          {t('Go to Migration Page')}
        </Button>
      ) : (
        shouldShowTransferWarnings && (
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
        )
      )}

      <MainActionButton onNext={onNext} />
    </>
  )
}

export default EnterDataStep
