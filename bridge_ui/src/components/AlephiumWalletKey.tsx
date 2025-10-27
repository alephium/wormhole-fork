import { Typography } from "@material-ui/core"
import { AlephiumConnectButton } from "@alephium/web3-react"
import { useTranslation } from "react-i18next"
import { shortenAddress } from "../utils/addresses"
import BridgeWidgetButton from "./BridgeWidget/BridgeWidgetButton"

const AlephiumWalletKey = () => {
  const { t } = useTranslation()

  return (
    <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
      {({ isConnected, show, account }) => {
        const address = account?.address

        return !isConnected || !address ? (
          <BridgeWidgetButton short onClick={show}>
            {t("Connect wallet")}
          </BridgeWidgetButton>
        ) : (
          <Typography variant="body2" style={{ textAlign: "right", opacity: 0.75 }}>
            {`${t("Connected wallets", { count: 1 })}: ${shortenAddress(address)}`}
          </Typography>
        )
      }}
    </AlephiumConnectButton.Custom>
  )
};

export default AlephiumWalletKey;
