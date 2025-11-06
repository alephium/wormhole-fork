import { ChainId } from "@alephium/wormhole-sdk"
import { TextField } from "@mui/material"
import { makeStyles } from '@mui/styles';
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch, useSelector } from "react-redux"
import {
  incrementStep,
  setSourceAsset,
  setSourceChain,
} from "../../store/attestSlice"
import {
  selectAttestIsSourceComplete,
  selectAttestShouldLockFields,
  selectAttestSourceAsset,
  selectAttestSourceChain,
} from "../../store/selectors"
import { CHAINS } from "../../utils/consts"
import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton"
import ChainSelect from "../ChainSelect"
import KeyAndBalance from "../KeyAndBalance"
import LowBalanceWarning from "../LowBalanceWarning"

interface SourceProps {
  showNextButton?: boolean
  sourceChain?: ChainId
  sourceAsset?: string
  onSourceChainChange?: (chainId: ChainId) => void
  onSourceAssetChange?: (asset: string) => void
}

const Source = ({
  showNextButton = true,
  sourceChain: sourceChainOverride,
  sourceAsset: sourceAssetOverride,
  onSourceChainChange,
  onSourceAssetChange
}: SourceProps) => {
  const { t } = useTranslation()
  const classes = useStyles()
  const dispatch = useDispatch()
  const storeSourceChain = useSelector(selectAttestSourceChain)
  const storeSourceAsset = useSelector(selectAttestSourceAsset)
  const storeIsSourceComplete = useSelector(selectAttestIsSourceComplete)
  const shouldLockFields = useSelector(selectAttestShouldLockFields)
  const sourceChain = sourceChainOverride ?? storeSourceChain
  const sourceAsset = sourceAssetOverride ?? storeSourceAsset
  const isSourceComplete =
    sourceChainOverride !== undefined || sourceAssetOverride !== undefined
      ? !!sourceChain && sourceAsset.trim().length > 0
      : storeIsSourceComplete
  const handleSourceChange = useCallback(
    (event: any) => {
      const nextChain = Number(event.target.value) as ChainId
      if (onSourceChainChange) {
        onSourceChainChange(nextChain)
        return
      }
      dispatch(setSourceChain(nextChain))
    },
    [dispatch, onSourceChainChange]
  )
  const handleAssetChange = useCallback(
    (event: any) => {
      const nextAsset = event.target.value as string
      if (onSourceAssetChange) {
        onSourceAssetChange(nextAsset)
        return
      }
      dispatch(setSourceAsset(nextAsset))
    },
    [dispatch, onSourceAssetChange]
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
        value={sourceChain}
        onChange={handleSourceChange}
        disabled={shouldLockFields}
        chains={CHAINS}
      />
      <KeyAndBalance chainId={sourceChain} />
      <TextField
        label={t("Asset")}
        variant="standard"
        fullWidth
        className={classes.transferField}
        value={sourceAsset}
        onChange={handleAssetChange}
        disabled={shouldLockFields}
      />
      <LowBalanceWarning chainId={sourceChain} />
      {showNextButton && (
        <BridgeWidgetButton
          short
          disabled={!isSourceComplete}
          onClick={handleNextClick}
          className={classes.nextButton}
        >
          {t("Next")}
        </BridgeWidgetButton>
      )}
    </>
  )
}

export default Source

const useStyles = makeStyles((theme) => ({
  transferField: {
    marginTop: theme.spacing(5),
  },
  nextButton: {
    marginTop: theme.spacing(4),
  },
}))
