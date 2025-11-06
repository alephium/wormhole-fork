import { Typography } from "@mui/material"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { selectAttestTargetChain } from "../../store/selectors"
import { CHAINS_BY_ID } from "../../utils/consts"

const TargetPreview = () => {
  const { t } = useTranslation()
  const targetChain = useSelector(selectAttestTargetChain)

  if (!targetChain) return null

  return (
    <Typography variant="body2" align="center">
      {t("Target chain: {{ chainName }}", {
        chainName: CHAINS_BY_ID[targetChain]?.name ?? t("Unknown chain")
      })}
    </Typography>
  )
}

export default TargetPreview
