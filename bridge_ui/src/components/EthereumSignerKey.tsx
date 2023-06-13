import { useCallback, useState } from "react";
import { Typography } from "@material-ui/core";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import ToggleConnectedButton from "./ToggleConnectedButton";
import EvmConnectWalletDialog from "./EvmConnectWalletDialog";
import { ChainId } from "alephium-wormhole-sdk";
import { getEvmChainId } from "../utils/consts";

const EthereumSignerKey = ({ chainId }: { chainId: ChainId }) => {
  const { disconnect, signerAddress, providerError, chainId: evmChainId } = useEthereumProvider();

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
        connected={!!signerAddress && getEvmChainId(chainId) === evmChainId}
        pk={signerAddress || ""}
      />
      <EvmConnectWalletDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        chainId={chainId}
      />
      {providerError ? (
        <Typography variant="body2" color="error">
          {providerError}
        </Typography>
      ) : null}
    </>
  );
};

export default EthereumSignerKey;
