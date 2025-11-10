import { ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Alert } from '@mui/material'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { GasEstimateSummary } from '../../../hooks/useTransactionFees'
import { incrementStep, setTargetChain } from '../../../store/attestSlice'
import {
  selectAttestIsTargetComplete,
  selectAttestShouldLockFields,
  selectAttestSourceChain,
  selectAttestTargetChain
} from '../../../store/selectors'
import { CHAINS, CHAINS_BY_ID } from '../../../utils/consts'
import BridgeWidgetButton from '../BridgeWidgetButton'
import ChainSelect from '../../ChainSelect'
import KeyAndBalance from '../../KeyAndBalance'
import LowBalanceWarning from '../../LowBalanceWarning'

interface TargetProps {
  showNextButton?: boolean
  targetChain?: ChainId
  onTargetChainChange?: (chainId: ChainId) => void
}

const Target = ({ showNextButton = true, targetChain: targetChainOverride, onTargetChainChange }: TargetProps) => {
  const { t } = useTranslation()
  const { classes } = useStyles()
  const dispatch = useDispatch()
  const sourceChain = useSelector(selectAttestSourceChain)
  const chains = useMemo(() => CHAINS.filter((c) => c.id !== sourceChain), [sourceChain])
  const storeTargetChain = useSelector(selectAttestTargetChain)
  const storeIsTargetComplete = useSelector(selectAttestIsTargetComplete)
  const shouldLockFields = useSelector(selectAttestShouldLockFields)
  const targetChain = targetChainOverride ?? storeTargetChain
  const isTargetComplete = targetChainOverride !== undefined ? !!targetChain : storeIsTargetComplete
  const handleTargetChange = useCallback(
    (event: any) => {
      const nextTarget = Number(event.target.value) as ChainId
      if (onTargetChainChange) {
        onTargetChainChange(nextTarget)
        return
      }
      dispatch(setTargetChain(nextTarget))
    },
    [dispatch, onTargetChainChange]
  )
  const handleNextClick = useCallback(() => {
    dispatch(incrementStep())
  }, [dispatch])
  return (
    <>
      <ChainSelect
        select
        variant="outlined"
        fullWidth
        value={targetChain}
        onChange={handleTargetChange}
        disabled={shouldLockFields}
        chains={chains}
      />
      <KeyAndBalance chainId={targetChain} />
      <Alert severity="info" className={classes.alert}>
        <Typography>
          {t('You will have to pay transaction fees on {{ chainName }} to attest this token.', {
            chainName: CHAINS_BY_ID[targetChain].name
          })}
        </Typography>
        {isEVMChain(targetChain) && <GasEstimateSummary methodType="createWrapped" chainId={targetChain} />}
      </Alert>
      <LowBalanceWarning chainId={targetChain} />
      {showNextButton && (
        <BridgeWidgetButton short disabled={!isTargetComplete} onClick={handleNextClick} className={classes.nextButton}>
          {t('Next')}
        </BridgeWidgetButton>
      )}
    </>
  )
}

export default Target

const useStyles = makeStyles()((theme) => ({
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  nextButton: {
    marginTop: theme.spacing(4)
  }
}))
