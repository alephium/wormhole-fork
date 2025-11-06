import { Typography } from "@mui/material"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { selectAttestSourceAsset, selectAttestSourceChain } from "../../store/selectors"
import { CHAINS_BY_ID } from "../../utils/consts"
import SmartAddress from "../SmartAddress"

const SourcePreview = () => {
  const { t } = useTranslation()
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)

  if (!sourceChain || !sourceAsset) return null

  return (
    <Typography variant="body2" align="center">
      {t("Will be attested on {{ chainName }}", {
        chainName: CHAINS_BY_ID[sourceChain]?.name ?? t("Unknown chain")
      })}
      <SmartAddress chainId={sourceChain} address={sourceAsset} isAsset />
    </Typography>
  )
}

export default SourcePreview
