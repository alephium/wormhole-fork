import { AppBar, Hidden, Button, Box, Link, Toolbar } from "@mui/material";
import React from "react";
import LogoLink from "./LogoLink";
import { useNetworkContext } from "../contexts/NetworkContext";

const linkStyle = { ml: 3, textUnderlineOffset: 6 };
const linkActiveStyle = { textDecoration: "underline" };

const NavBar = () => {
  const { activeNetwork } = useNetworkContext()
  const bridgeLink = activeNetwork.name === 'mainnet'
    ? "https://bridge.alephium.org"
    : "https://testnet.bridge.alephium.org"
  return (<AppBar
    position="static"
    sx={{ backgroundColor: "transparent" }}
    elevation={0}
  >
    <Toolbar disableGutters sx={{ mt: 2, mx: 4 }}>
      <LogoLink />
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Link
          href={bridgeLink}
          color="inherit"
          underline="hover"
          sx={linkStyle}
        >
          Bridge
        </Link>
        <Link
          href={"https://alephium.org/"}
          color="inherit"
          underline="hover"
          sx={linkStyle}
        >
          Alephium
        </Link>
      </Box>
      {/* <Box sx={{ display: "flex", ml: 8 }}>
        <img src={hamburger} alt="menu" />
      </Box> */}
    </Toolbar>
  </AppBar>)
};
export default NavBar;
