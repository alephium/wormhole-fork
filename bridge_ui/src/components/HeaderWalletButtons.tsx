import {
  IconButton,
  Menu,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { AccountBalanceWalletOutlined } from "@mui/icons-material"
import { useConnect, useWallet } from "@alephium/web3-react"
import { MouseEvent, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useEthereumProvider } from "../contexts/EthereumProviderContext"
import { CHAIN_ID_ALEPHIUM } from "@alephium/wormhole-sdk"
import { CHAINS_BY_ID, ChainInfo, getEvmChainId } from "../utils/consts"
import WalletAddressButton from "./WalletAddressButton"
import { COLORS } from "../muiTheme"
import Divider from "./BridgeWidget/Divider"
import { useSelector } from "react-redux"
import { selectTransferHasSentTokens, selectTransferIsSending, selectTransferTransferTx } from "../store/selectors"
import { shortenAddress } from "../utils/addresses"
import SuccessPulse from "./BridgeWidget/SuccessPulse"

const ALEPHIUM_CHAIN_INFO = CHAINS_BY_ID[CHAIN_ID_ALEPHIUM]

const getEvmChainInfo = (evmChainId: number | undefined): ChainInfo | undefined => {
  if (evmChainId === undefined) {
    return undefined
  }
  const chainInfos: ChainInfo[] = Object.values(CHAINS_BY_ID)
  return chainInfos.find(({ id }) => getEvmChainId(id) === evmChainId)
}

const HeaderWalletButtons = () => {
  const classes = useStyles()
  const { t } = useTranslation()
  const { signerAddress, chainId, disconnect: disconnectEvm } = useEthereumProvider()
  const alphWallet = useWallet()
  const { disconnect: disconnectAlephium } = useConnect()
  const hasAlephiumWallet =
    alphWallet.connectionStatus === "connected" && !!alphWallet.account?.address
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [walletAnchorEl, setWalletAnchorEl] = useState<null | HTMLElement>(null)
  const walletMenuId = "app-wallet-menu"
  const walletMenuOpen = !!walletAnchorEl
  const evmChainInfo = useMemo(() => getEvmChainInfo(chainId), [chainId])
  const transferTx = useSelector(selectTransferTransferTx)
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  const isSending = useSelector(selectTransferIsSending)
  const isDisconnectDisabled = isSending || (!!transferTx && !hasSentTokens)

  const walletEntries = useMemo(() => {
    const entries: Array<{
      key: string
      address: string
      chainName: string
      disconnect: () => Promise<void> | void
    }> = []

    if (signerAddress) {
      entries.push({
        key: "evm",
        address: signerAddress,
        chainName: evmChainInfo?.name ?? "EVM",
        disconnect: disconnectEvm,
      })
    }

    if (hasAlephiumWallet && alphWallet.account?.address && ALEPHIUM_CHAIN_INFO) {
      entries.push({
        key: "alephium",
        address: alphWallet.account.address,
        chainName: ALEPHIUM_CHAIN_INFO.name,
        disconnect: disconnectAlephium,
      })
    }

    return entries
  }, [alphWallet.account?.address, disconnectAlephium, disconnectEvm, evmChainInfo?.name, hasAlephiumWallet, signerAddress])

  if (walletEntries.length === 0) {
    return null
  }

  const connectedCount = walletEntries.length

  const handleWalletMenuButtonClick = (event: MouseEvent<HTMLElement>) => {
    if (walletMenuOpen) {
      setWalletAnchorEl(null)
    } else {
      setWalletAnchorEl(event.currentTarget)
    }
  }

  const handleWalletMenuClose = () => {
    setWalletAnchorEl(null)
  }

  const walletButtons = walletEntries.map(({ address, chainName, disconnect}) =>
    <SuccessPulse>
      <WalletAddressButton
        key={address}
        address={address}
        chainName={chainName}
        onDisconnect={disconnect}
        iconType="chainLogo"
        disableDisconnect={isDisconnectDisabled}
      >
        <Typography className={classes.addressText}>{shortenAddress(address)}</Typography>
      </WalletAddressButton>
    </SuccessPulse>
  )

  if (isMobile) {
    return (
      <>
        <div className={classes.mobileWalletWrapper}>
          <IconButton
            aria-label={t("Open wallet menu")}
            aria-controls={walletMenuOpen ? walletMenuId : undefined}
            aria-haspopup="true"
            onClick={handleWalletMenuButtonClick}
            className={classes.mobileWalletTrigger}
          >
            <AccountBalanceWalletOutlined />
          </IconButton>
          {connectedCount > 1 ? (
            <span className={classes.walletCountBubble}>{connectedCount}</span>
          ) : null}
        </div>
        <Menu
          id={walletMenuId}
          anchorEl={walletAnchorEl}
          open={walletMenuOpen}
          onClose={handleWalletMenuClose}
          keepMounted
          classes={{ paper: classes.walletMenuPaper }}
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          MenuListProps={{ disablePadding: true, autoFocusItem: false }}
        >
          <Typography variant="subtitle2" gutterBottom>
            {t("Connected wallets", { count: connectedCount })}
          </Typography>
          <Divider />
          <div className={classes.walletMenuContent}>{walletButtons}</div>
        </Menu>
      </>
    )
  }

  return (
    <div className={classes.container}>
      <div className={classes.walletButtonsLabelContainer}>
        <AccountBalanceWalletOutlined style={{ opacity: 0.5 }} fontSize="small" />
        <span className={classes.walletButtonsLabel}>{t("Connected wallets")}</span>
      </div>
      {walletButtons}
    </div>
  )
}

export default HeaderWalletButtons

const useStyles = makeStyles((theme) => ({
  container: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    border: `1px solid ${COLORS.whiteWithStrongTransparency}`,
    padding: theme.spacing(0.5),
    borderRadius: 13,
    '&:hover $walletButtonsLabel': {
      maxWidth: 400,
      paddingLeft: theme.spacing(1)
    },
  },
  walletButtonsLabelContainer: {
    display: "flex",
    alignItems: "center",
    borderRight: `1px solid ${COLORS.whiteWithStrongTransparency}`,
    paddingRight: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  },
  walletButtonsLabel: {
    maxWidth: 0,
    fontSize: 13,
    color: COLORS.whiteWithMediumTransparency,
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  mobileWalletTrigger: {
    color: "white",
    [theme.breakpoints.up("md")]: {
      display: "none",
    },
  },
  walletButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
  },
  iconOnlyWalletButton: {
    padding: theme.spacing(0.5, 1),
  },
  menuWalletButton: {
    width: "auto",
    justifyContent: "flex-start",
    alignSelf: "flex-start",
  },
  addressText: {
    fontSize: 14,
    fontWeight: 500,
  },
  walletMenuPaper: {
    backgroundColor: "rgba(18, 18, 18, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5, 1.25)
  },
  walletMenuContent: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
    paddingTop: theme.spacing(1)
  },
  mobileWalletWrapper: {
    position: "relative",
    display: "inline-flex",
  },
  walletCountBubble: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: COLORS.nearBlack,
    border: "1px solid rgba(255, 255, 255, 0.16)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
  },
}))
