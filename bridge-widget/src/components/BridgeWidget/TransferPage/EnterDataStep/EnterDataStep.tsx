import { AnimatePresence, motion } from 'framer-motion'

import { useSelector } from 'react-redux'
import useIsWalletReady from '../../../../hooks/useIsWalletReady'
import { selectTransferShouldLockFields, selectTransferSourceChain, selectTransferTargetChain } from '../../../../store/selectors'
import { TokenSelector2 } from '../../SourceTokenSelector2'
import useSyncTargetAddress from '../../../../hooks/useSyncTargetAddress'
import useGetTargetParsedTokenAccounts from '../../../../hooks/useGetTargetParsedTokenAccounts'
import MainActionButton from '../../MainActionButton'
import ChainSelectors from '../../ChainSelectors'
import Warnings from './Warnings'

// Copied from Source.tsx

interface EnterDataStepProps {
  onNext?: () => void
}

const EnterDataStep = ({ onNext }: EnterDataStepProps) => {
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { isReady: isTargetChainReady } = useIsWalletReady(targetChain)
  const { isReady: isSourceChainReady } = useIsWalletReady(sourceChain)
  const shouldLockFields = useSelector(selectTransferShouldLockFields)
  const walletsReady = isSourceChainReady && isTargetChainReady

  useGetTargetParsedTokenAccounts()
  useSyncTargetAddress(!shouldLockFields)

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

      <Warnings />

      <MainActionButton onNext={onNext} />
    </>
  )
}

export default EnterDataStep
