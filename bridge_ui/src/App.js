import {
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
} from "@alephium/wormhole-sdk";
import {
  AppBar,
  Container,
  Hidden,
  IconButton,
  Link,
  makeStyles,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { HelpOutline } from "@material-ui/icons";
import { useCallback } from "react";
import { useHistory, useLocation } from "react-router";
import {
  Link as RouterLink,
  NavLink,
  Redirect,
  Route,
  Switch,
} from "react-router-dom";
import Attest from "./components/Attest";
import Footer from "./components/Footer";
import HeaderText from "./components/HeaderText";
import Migration from "./components/Migration";
import EvmQuickMigrate from "./components/Migration/EvmQuickMigrate";
import SolanaQuickMigrate from "./components/Migration/SolanaQuickMigrate";
import Recovery from "./components/Recovery";
import Stats from "./components/Stats";
import CustodyAddresses from "./components/Stats/CustodyAddresses";
import TokenOriginVerifier from "./components/TokenOriginVerifier";
import Transactions from "./components/Transactions";
import Transfer from "./components/Transfer";
import UnwrapNative from "./components/UnwrapNative";
import WithdrawTokensTerra from "./components/WithdrawTokensTerra";
import { useBetaContext } from "./contexts/BetaContext";
import Alephium from "./icons/alephium.svg";
import { CLUSTER } from "./utils/consts";
import { useWallet } from "@alephium/web3-react";
import { useEffect } from "react";
import { web3 } from "@alephium/web3";
import backgroundGradient from "./images/top-gradient.png";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  appBar: {
    background: "transparent",
    marginTop: theme.spacing(2),
    "& > .MuiToolbar-root": {
      margin: "auto",
      marginBottom: theme.spacing(10),
      maxWidth: 960,
    },
  },
  spacer: {
    flex: 1,
    width: "100vw",
  },
  link: {
    ...theme.typography.body2,
    fontWeight: 600,
    fontFamily: "Switzer, sans-serif",
    color: "white",
    marginLeft: theme.spacing(4),
    textUnderlineOffset: "6px",
    [theme.breakpoints.down("sm")]: {
      marginLeft: theme.spacing(2.5),
    },
    [theme.breakpoints.down("xs")]: {
      marginLeft: theme.spacing(1),
    },
    "&.active": {
      textDecoration: "underline",
    },
  },
  bg: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    "&:hover": {
      textDecoration: "none",
    },
  },
  iconButton: {
    [theme.breakpoints.up("md")]: {
      marginRight: theme.spacing(2.5),
    },
    [theme.breakpoints.down("sm")]: {
      marginRight: theme.spacing(2.5),
    },
    [theme.breakpoints.down("xs")]: {
      marginRight: theme.spacing(1),
    },
  },
  betaBanner: {
    backgroundColor: "rgba(255,255,255,0.15)",
    padding: theme.spacing(1, 0),
  },
  alephiumLogo: {
    height: 50,
    "&:hover": {
      filter: "contrast(1)",
    },
    verticalAlign: "middle",
    marginRight: theme.spacing(1),
    display: "inline-block",
  },
  topGradient: {
    position: "absolute",
    height: 300,
    width: "100%",
    backgroundImage: `url(${backgroundGradient})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "top center",
    backgroundSize: "contain",
  },
}));

function App() {
  const { t } = useTranslation();
  const classes = useStyles();
  const isBeta = useBetaContext();
  const { push } = useHistory();
  const { pathname } = useLocation();
  const wallet = useWallet();
  const handleTabChange = useCallback(
    (event, value) => {
      push(value);
    },
    [push]
  );

  useEffect(() => {
    if (wallet?.nodeProvider !== undefined) {
      web3.setCurrentNodeProvider(wallet.nodeProvider);
    }
  }, [wallet?.nodeProvider]);

  return (
    <div className={classes.bg}>
      {CLUSTER === "mainnet" ? null : (
        <AppBar position="static" className={classes.betaBanner} elevation={0}>
          <Typography style={{ textAlign: "center" }}>
            {t("Caution! You are using the {{ networkName }} build of this app.", { networkName: CLUSTER })}
          </Typography>
        </AppBar>
      )}
      <div className={classes.topGradient} />
      <AppBar
        position="static"
        color="inherit"
        className={classes.appBar}
        elevation={0}
      >
        <Toolbar>
          <Link
            component={RouterLink}
            to="/transfer"
            className={classes.brandLink}
          >
            <img
              src={Alephium}
              alt={t("Alephium")}
              className={classes.alephiumLogo}
            />
          </Link>
          <div className={classes.spacer} />
          <Hidden implementation="css" xsDown>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Link
                component={NavLink}
                to="/transfer"
                color="inherit"
                className={classes.link}
              >
                {t("Bridge")}
              </Link>
              <Link
                href="https://explorer.bridge.alephium.org"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                className={classes.link}
              >
                {t("Explorer")}
              </Link>
              <Link
                href="https://alephium.org"
                target="_blank"
                rel="noopener noreferrer"
                color="inherit"
                className={classes.link}
              >
                {t("Alephium")}
              </Link>
            </div>
          </Hidden>
          <Hidden implementation="css" smUp>
            <Tooltip title={t("View the FAQ")}>
              <IconButton
                href="https://docs.wormholenetwork.com/wormhole/faqs"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                className={classes.link}
              >
                <HelpOutline />
              </IconButton>
            </Tooltip>
          </Hidden>
        </Toolbar>
      </AppBar>
      {isBeta ? (
        <AppBar position="static" className={classes.betaBanner} elevation={0}>
          <Typography style={{ textAlign: "center" }}>
            {t("Caution! You have enabled the beta. Enter the secret code again to disable.")}
          </Typography>
        </AppBar>
      ) : null}
      {["/transfer", "/redeem", "/transactions"].includes(pathname) ? (
        <Container maxWidth="md" style={{ paddingBottom: 24 }}>
          <HeaderText
            white
            subtitle={
              <>
                <Typography variant="h5">
                  {t("A bridge that offers unlimited transfers across chains for tokens.")}
                </Typography>
              </>
            }
          >
            {t("Token Bridge")} 🌉
          </HeaderText>
          <Tabs
            value={pathname}
            variant="fullWidth"
            onChange={handleTabChange}
            indicatorColor="primary"
          >
            <Tab label={t("Tokens_other")} value="/transfer" disableRipple />
            {/* <Tab label="NFTs" value="/nft" /> */}
            <Tab label={t("Redeem")} value="/redeem" to="/redeem" disableRipple />
            <Tab
              label={t("Transactions")}
              value="/transactions"
              to="/transactions"
              disableRipple
            />
          </Tabs>
        </Container>
      ) : null}
      <Switch>
        <Route exact path="/transfer">
          <Transfer />
        </Route>
        {/* <Route exact path="/nft"> <NFT /> </Route> */}
        <Route exact path="/redeem">
          <Recovery />
        </Route>
        <Route exact path="/transactions">
          <Transactions />
        </Route>
        {/* <Route exact path="/nft-origin-verifier"> <NFTOriginVerifier /> </Route> */}
        <Route exact path="/token-origin-verifier">
          <TokenOriginVerifier />
        </Route>
        <Route exact path="/register">
          <Attest />
        </Route>
        <Route exact path="/migrate/Solana/:legacyAsset/:fromTokenAccount">
          <Migration chainId={CHAIN_ID_SOLANA} />
        </Route>
        <Route exact path="/migrate/Ethereum/:legacyAsset/">
          <Migration chainId={CHAIN_ID_ETH} />
        </Route>
        <Route exact path="/migrate/BinanceSmartChain/:legacyAsset/">
          <Migration chainId={CHAIN_ID_BSC} />
        </Route>
        <Route exact path="/migrate/Ethereum/">
          <EvmQuickMigrate chainId={CHAIN_ID_ETH} />
        </Route>
        <Route exact path="/migrate/BinanceSmartChain/">
          <EvmQuickMigrate chainId={CHAIN_ID_BSC} />
        </Route>
        <Route exact path="/migrate/Solana/">
          <SolanaQuickMigrate />
        </Route>
        <Route exact path="/stats">
          <Stats />
        </Route>
        <Route exact path="/withdraw-tokens-terra">
          <WithdrawTokensTerra />
        </Route>
        <Route exact path="/unwrap-native">
          <UnwrapNative />
        </Route>
        <Route exact path="/custody-addresses">
          <CustodyAddresses />
        </Route>
        <Route>
          <Redirect to="/transfer" />
        </Route>
      </Switch>
      <div className={classes.spacer} />
      <Footer />
    </div>
  );
}

export default App;
