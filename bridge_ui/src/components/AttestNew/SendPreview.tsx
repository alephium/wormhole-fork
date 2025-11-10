import { Typography } from "@mui/material"
import { useTranslation } from "react-i18next"
import { useSelector } from "react-redux"
import { selectAttestAttestTx, selectAttestSourceChain } from "../../store/selectors"
import ShowTx from "../ShowTx"

const SendPreview = () => {
  const { t } = useTranslation()
  const sourceChain = useSelector(selectAttestSourceChain)
  const attestTx = useSelector(selectAttestAttestTx)

  return (
    <div>
      <Typography variant="body2">{t("The token has been attested")}</Typography>
      {attestTx && <ShowTx chainId={sourceChain} tx={attestTx} />}
    </div>
  )
}

export default SendPreview
