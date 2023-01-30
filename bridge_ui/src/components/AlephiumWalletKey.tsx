import { Typography } from "@material-ui/core";
import { useCallback, useState } from "react";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import AlephiumConnectWalletDialog from "./AlephiumConnectWalletDialog";
import ToggleConnectedButton from "./ToggleConnectedButton";

const AlephiumWalletKey = () => {
  const { disconnect, signer, error } =
    useAlephiumWallet();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, [setIsDialogOpen]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, [setIsDialogOpen]);

  return (
    <>
      <ToggleConnectedButton
        connect={openDialog}
        disconnect={disconnect}
        connected={!!signer}
        pk={signer?.address || ""}
      />
      <AlephiumConnectWalletDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
      />
      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
    </>
  );
};

export default AlephiumWalletKey;
