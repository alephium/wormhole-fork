import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
  MenuItem,
  OutlinedTextFieldProps,
  Popover,
  TextField,
  Typography,
} from "@material-ui/core";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useBetaContext } from "../contexts/BetaContext";
import { BETA_CHAINS, ChainInfo } from "../utils/consts";
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from "@alephium/wormhole-sdk";
import { AlephiumConnectButton } from "@alephium/web3-react";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import useCopyToClipboard from "../hooks/useCopyToClipboard";

const useStyles = makeStyles((theme) => ({
  chainSelectContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    padding: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "20px",
  },
  select: {
    "& .MuiSelect-root": {
      display: "flex",
      alignItems: "center",
      padding: 0,
    },

    "& fieldset": {
      border: "none",
    },

    "& .MuiSelect-iconOutlined": {
      right: "-5px",
    },

    "& .MuiSelect-selectMenu:focus": {
      backgroundColor: "transparent",
    },

    "& label": {
      display: "none",
    },
  },
  listItemIcon: {
    minWidth: 40,
  },
  icon: {
    height: 24,
    width: 24,
  },
  accountAddress: {
    fontSize: "14px",
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: 600,
    cursor: "pointer",
    "&:hover": {
      color: "rgba(255, 255, 255, 0.7)",
    },
  },
  modalTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalContent: {
    minWidth: "200px",
  },
  chainSelectLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));

const createChainMenuItem = ({ id, name, logo }: ChainInfo, classes: any) => (
  <MenuItem key={id} value={id}>
    <ListItemIcon className={classes.listItemIcon}>
      <img src={logo} alt={name} className={classes.icon} />
    </ListItemIcon>
    <ListItemText>{name}</ListItemText>
  </MenuItem>
);

interface ChainSelectProps extends OutlinedTextFieldProps {
  chains: ChainInfo[];
}

export default function ChainSelect2({ chains, ...rest }: ChainSelectProps) {
  const classes = useStyles();
  const isBeta = useBetaContext();
  const filteredChains = useMemo(
    () => chains.filter(({ id }) => (isBeta ? true : !BETA_CHAINS.includes(id))),
    [chains, isBeta]
  );
  return (
    <div className={classes.chainSelectContainer}>
      <div className={classes.chainSelectLabelRow}>
        <Label>{rest.label}</Label>
        <ConnectedChainAccount chainId={rest.value as ChainId} />
      </div>
      <TextField {...rest} className={clsx(classes.select, rest.className)}>
        {filteredChains.map((chain) => createChainMenuItem(chain, classes))}
      </TextField>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <Typography style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255, 255, 255, 0.5)" }}>{children}</Typography>
);

const ConnectedChainAccount = ({ chainId }: { chainId: ChainId }) => {
  if (isEVMChain(chainId)) {
    return <CurrentlyConnectedEVMAccount />;
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ isConnected, show, disconnect, account }) => {
          return (
            // `show` and `hide` will never be undefined. TODO: Fix the types in web3-react
            account?.address && <AccountAddress address={account.address} disconnect={disconnect} />
          );
        }}
      </AlephiumConnectButton.Custom>
    );
  }

  return null;
};

const CurrentlyConnectedEVMAccount = () => {
  const { signerAddress, disconnect } = useEthereumProvider();
  return signerAddress ? <AccountAddress address={signerAddress} disconnect={disconnect} /> : null;
};

const AccountAddress = ({ address, disconnect }: { address: string; disconnect: () => void }) => {
  const classes = useStyles();

  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const copyToClipboard = useCopyToClipboard(address);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setAnchorEl(null);
  };

  const handleCopy = () => {
    copyToClipboard();
    handleClose();
  };

  return (
    <>
      <Typography className={classes.accountAddress} onClick={handleOpen}>
        {address.slice(0, 5) + "..." + address.slice(-5)}
      </Typography>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        classes={{ paper: classes.modalContent }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <List>
          <ListItem button onClick={handleCopy}>
            <ListItemText primary="Copy address" />
          </ListItem>
          <ListItem button onClick={disconnect}>
            <ListItemText primary="Disconnect" />
          </ListItem>
        </List>
      </Popover>
    </>
  );
};
