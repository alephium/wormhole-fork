import { makeStyles, TextField } from "@material-ui/core"
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
}

function Source({ showNextButton = true }: SourceProps) {
  const { t } = useTranslation()
  const classes = useStyles()
  const dispatch = useDispatch()
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)
  const isSourceComplete = useSelector(selectAttestIsSourceComplete)
  const shouldLockFields = useSelector(selectAttestShouldLockFields)
  const handleSourceChange = useCallback(
    (event: any) => {
      dispatch(setSourceChain(event.target.value))
    },
    [dispatch]
  )
  const handleAssetChange = useCallback(
    (event: any) => {
      dispatch(setSourceAsset(event.target.value))
    },
    [dispatch]
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
        variant="outlined"
        fullWidth
        className={classes.transferField}
        value={sourceAsset}
        onChange={handleAssetChange}
        disabled={shouldLockFields}
      />
      <LowBalanceWarning chainId={sourceChain} />
      {showNextButton && (
        <BridgeWidgetButton
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
