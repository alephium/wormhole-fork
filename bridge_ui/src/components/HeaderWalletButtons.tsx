import {
  IconButton,
  Menu,
  Typography,
  makeStyles,
  useMediaQuery,
  useTheme,
} from "@material-ui/core"
import { AccountBalanceWalletOutlined } from "@material-ui/icons"
import { useConnect, useWallet } from "@alephium/web3-react"
import { MouseEvent, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useEthereumProvider } from "../contexts/EthereumProviderContext"
import { CHAIN_ID_ALEPHIUM } from "@alephium/wormhole-sdk"
import { CHAINS_BY_ID, ChainInfo, getEvmChainId } from "../utils/consts"
import WalletAddressButton from "./WalletAddressButton"
import { COLORS } from "../muiTheme"
import Divider from "./BridgeWidget/Divider"

const ALEPHIUM_CHAIN_INFO = CHAINS_BY_ID[CHAIN_ID_ALEPHIUM]

const shortenAddress = (address: string) =>
  address.length > 10 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address

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
  const walletMenuOpen = Boolean(walletAnchorEl)
  const evmChainInfo = useMemo(() => getEvmChainInfo(chainId), [chainId])

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

  const renderWalletButton = (
    { key, address, chainName, disconnect }: (typeof walletEntries)[number],
    { onlyIcon, className }: { onlyIcon: boolean; className?: string }
  ) => (
    <WalletAddressButton
      key={key}
      address={address}
      chainName={chainName}
      onDisconnect={disconnect}
      iconType="chainLogo"
      onlyShowChainIcon={onlyIcon}
    >
      <Typography className={classes.addressText}>{shortenAddress(address)}</Typography>
    </WalletAddressButton>
  )

  const desktopButtons = walletEntries.map((entry) =>
    renderWalletButton(entry, { onlyIcon: true, className: classes.iconOnlyWalletButton })
  )
  const menuButtons = walletEntries.map((entry) =>
    renderWalletButton(entry, { onlyIcon: false, className: classes.menuWalletButton })
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
          <div className={classes.walletMenuContent}>{menuButtons}</div>
        </Menu>
      </>
    )
  }

  return <div className={classes.container}>{desktopButtons}</div>
}

export default HeaderWalletButtons

const useStyles = makeStyles((theme) => ({
  container: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
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
