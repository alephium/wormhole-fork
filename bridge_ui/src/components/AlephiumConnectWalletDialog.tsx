import {
  Dialog,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import { useCallback } from "react";
import walletconnectIcon from "../icons/walletconnect.svg";
import alephiumIcon from "../icons/alephium.svg"
import { ConnectType, useAlephiumWallet } from "../contexts/AlephiumWalletContext";

interface Connection {
  connectType: ConnectType
  name: string
  icon: string
}

const connections: Connection[] = [
  {
    connectType: ConnectType.WALLETCONNECT,
    name: "Wallet Connect",
    icon: walletconnectIcon
  },
  {
    connectType: ConnectType.WEBEXTENSION,
    name: "Web Extension",
    icon: alephiumIcon
  }
]

const useStyles = makeStyles((theme) => ({
  flexTitle: {
    display: "flex",
    alignItems: "center",
    "& > div": {
      flexGrow: 1,
      marginRight: theme.spacing(4),
    },
    "& > button": {
      marginRight: theme.spacing(-1),
    },
  },
  icon: {
    height: 24,
    width: 24,
  },
}));

const WalletOptions = ({
  connection,
  connect,
  onClose,
}: {
  connection: Connection;
  connect: (connectType: ConnectType) => void;
  onClose: () => void;
}) => {
  const classes = useStyles();

  const handleClick = useCallback(() => {
    connect(connection.connectType);
    onClose();
  }, [connect, connection, onClose]);

  return (
    <ListItem button onClick={handleClick}>
      <ListItemIcon>
        <img
          src={connection.icon}
          alt={connection.name}
          className={classes.icon}
        />
      </ListItemIcon>
      <ListItemText>{connection.name}</ListItemText>
    </ListItem>
  );
};

const AlephiumConnectWalletDialog = ({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { connect } = useAlephiumWallet();
  const classes = useStyles();

  const availableWallets = connections.map((connection) => (
      <WalletOptions
        connection={connection}
        connect={connect}
        onClose={onClose}
        key={connection.name}
      />
    ));

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>
        <div className={classes.flexTitle}>
          <div>Select your wallet</div>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>
      <List>{availableWallets}</List>
    </Dialog>
  );
};

export default AlephiumConnectWalletDialog;
