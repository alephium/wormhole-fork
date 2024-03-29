import { Button } from "@mui/material";
import { Link as RouterLink } from "gatsby";
import React from "react";
import logo from "../images/alephium.svg";
import { home } from "../utils/urls";

const LogoLink = ({ negMt = false }: { negMt?: boolean }) => (
  <Button
    size="small"
    component={RouterLink}
    to={home}
    sx={{
      display: "flex",
      p: 1,
      borderRadius: "8px",
      ml: -1,
      mt: negMt ? -1 : 0,
    }}
  >
    <img src={logo} alt="Alephium" height={50} />
  </Button>
);

export default LogoLink;
