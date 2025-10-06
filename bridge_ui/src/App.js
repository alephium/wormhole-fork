import {
  AppBar,
  Container,
  Link,
  makeStyles,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@material-ui/core";
import { useCallback } from "react";
import { useHistory, useLocation } from "react-router";
import { Link as RouterLink, NavLink, Redirect, Route, Switch } from "react-router-dom";
import Attest from "./components/Attest";
import HeaderText from "./components/HeaderText";
import Recovery from "./components/Recovery";
import Stats from "./components/Stats";
import CustodyAddresses from "./components/Stats/CustodyAddresses";
import TokenOriginVerifier from "./components/TokenOriginVerifier";
import Transactions from "./components/Transactions";
import Transfer from "./components/Transfer";
import BridgeWidget from "./components/BridgeWidget";
import UnwrapNative from "./components/UnwrapNative";
import { useBetaContext } from "./contexts/BetaContext";
import AlephiumLogo from "./icons/alephium.svg";
import { CLUSTER } from "./utils/consts";
import { useWallet } from "@alephium/web3-react";
import { useEffect } from "react";
import { web3 } from "@alephium/web3";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  appBar: {
    background: "transparent",
    flexDirection: "row",
    marginTop: theme.spacing(2),
    "& > .MuiToolbar-root": {
      margin: "0 20px",
      marginBottom: theme.spacing(6),
      minWidth: 0,
    },
  },
  spacer: {
    flex: 1,
    width: "100vw",
  },
  link: {
    ...theme.typography.body2,
    opacity: 0.6,
    fontWeight: 500,
    fontFamily: "Inter, sans-serif",
    color: "white",
    marginLeft: theme.spacing(4),
    [theme.breakpoints.down("sm")]: {
      marginLeft: theme.spacing(2.5),
    },
    [theme.breakpoints.down("xs")]: {
      marginLeft: theme.spacing(1),
    },
    "&:hover": {
      opacity: 1,
      textDecoration: "none",
    },
    "&.active": {
      opacity: 1,
    },
  },
  bg: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden"
  },
  bgGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "40%",
    background: "radial-gradient(ellipse at 50% 100%,rgb(28, 28, 28) 25%, transparent 60%)"
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
    height: 30,
    verticalAlign: "middle",
    marginRight: theme.spacing(1),
    display: "inline-block",
  },
  alephiumLogoText1: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.5)",
    marginLeft: theme.spacing(1),
    lineHeight: 1.1
  },
  alephiumLogoText2: {
    fontSize: 16,
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.9)",
    marginLeft: theme.spacing(1),
    lineHeight: 1.1
  }
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
      <div className={classes.bgGradient} />
      {CLUSTER === "mainnet" ? null : (
        <AppBar position="static" className={classes.betaBanner} elevation={0}>
          <Typography style={{ textAlign: "center" }}>
            {t("Caution! You are using the {{ networkName }} build of this app.", { networkName: CLUSTER })}
          </Typography>
        </AppBar>
      )}
      <AppBar position="static" color="inherit" className={classes.appBar} elevation={0}>
        <Toolbar>
          <Link component={RouterLink} to="/bridge" className={classes.brandLink}>
            <img src={AlephiumLogo} alt={t("Alephium")} className={classes.alephiumLogo} />
            <div className={classes.alephiumLogoTextContainer}>
              <Typography className={classes.alephiumLogoText1}>Alephium</Typography>
              <Typography className={classes.alephiumLogoText2}>Bridge</Typography>
            </div>
          </Link>
          <div className={classes.spacer} />

          <div style={{ display: "flex", alignItems: "center" }}>
            <Link component={NavLink} to="/bridge" color="inherit" className={classes.link}>
              {t("Bridge")}
            </Link>
            <Link component={NavLink} to="/transfer" color="inherit" className={classes.link}>
              {t("Legacy tools")}
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
          <Tabs value={pathname} variant="fullWidth" onChange={handleTabChange} indicatorColor="primary">
            <Tab label={t("Tokens_other")} value="/transfer" disableRipple />
            {/* <Tab label="NFTs" value="/nft" /> */}
            <Tab label={t("Redeem")} value="/redeem" to="/redeem" disableRipple />
            <Tab label={t("Transactions")} value="/transactions" to="/transactions" disableRipple />
          </Tabs>
        </Container>
      ) : null}
      <Switch>
        <Route exact path="/bridge">
          <BridgeWidget />
        </Route>
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
        <Route exact path="/stats">
          <Stats />
        </Route>
        <Route exact path="/unwrap-native">
          <UnwrapNative />
        </Route>
        <Route exact path="/custody-addresses">
          <CustodyAddresses />
        </Route>
        <Route>
          <Redirect to="/bridge" />
        </Route>
      </Switch>
      <div className={classes.spacer} />
      {/* <Footer /> */}
    </div>
  );
}

export default App;

const useStyles = makeStyles((theme) => ({
  appBar: {
    background: "transparent",
    flexDirection: "row",
    marginTop: theme.spacing(2),
    "& > .MuiToolbar-root": {
      margin: "0 20px",
      marginBottom: theme.spacing(8),
      minWidth: 0,
    },
  },
  spacer: {
    flex: 1,
    width: "100vw",
  },
  link: {
    ...theme.typography.body2,
    opacity: 0.6,
    fontWeight: 500,
    fontFamily: "Inter, sans-serif",
    color: "white",
    "&:hover": {
      opacity: 1,
      textDecoration: "none",
    },
    "&.active": {
      opacity: 1,
    },
  },
  bg: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden"
  },
    bgGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "42%",
    background: `radial-gradient(ellipse at 50% 0%, rgb(17, 17, 17) 0%, transparent 60%)`,
    zIndex: -1,

    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${noise})`,
      backgroundRepeat: "repeat",
      backgroundSize: "auto",
      pointerEvents: "none",
      WebkitMaskImage: `radial-gradient(ellipse at 50% 0%, #000 0%, transparent 60%)`,
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskSize: "cover",
      maskImage: `radial-gradient(ellipse at 50% 0%, #000 0%, transparent 60%)`,
      maskRepeat: "no-repeat",
      maskSize: "cover",
      opacity: 0.5
    },
  },
  brandLink: {
    display: "inline-flex",
    alignItems: "center",
    "&:hover": {
      textDecoration: "none",
    },
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minHeight: "inherit",
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(3),
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(4),
    marginLeft: theme.spacing(4),
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
    [theme.breakpoints.down("xs")]: {
      display: "none",
    },
    flexWrap: "wrap",
  },
  toolbarGrow: {
    flexGrow: 1,
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
    height: 30,
    verticalAlign: "middle",
    marginRight: theme.spacing(1),
    display: "inline-block",
  },
  alephiumLogoText1: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.5)",
    marginLeft: theme.spacing(1),
    lineHeight: 1.1
  },
  alephiumLogoText2: {
    fontSize: 16,
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.9)",
    marginLeft: theme.spacing(1),
    lineHeight: 1.1,
  },
  mobileNavTrigger: {
    color: "white",
    [theme.breakpoints.up("md")]: {
      display: "none",
    },
  },
  mobileMenuPaper: {
    backgroundColor: "rgba(18, 18, 18, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 12,
    marginTop: theme.spacing(1),
    minWidth: 220,
    padding: theme.spacing(1),
  },
  mobileMenuItem: {
    color: "white",
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: theme.spacing(1),
    justifyContent: "flex-start",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    "&.Mui-selected": {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
  },
}));