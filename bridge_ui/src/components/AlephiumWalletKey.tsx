import { useCallback, useState } from "react";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import AlephiumConnectWalletDialog from "./AlephiumConnectWalletDialog";
import ToggleConnectedButton from "./ToggleConnectedButton";

const AlephiumWalletKey = () => {
  const { disconnect, signer } =
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
        pk={signer?.account.address || ""}
      />
      <AlephiumConnectWalletDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
      />
    </>
  );
};

export default AlephiumWalletKey;
