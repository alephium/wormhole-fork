import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import ToggleConnectedButton from "./ToggleConnectedButton";

const AlephiumWalletKey = () => {
  const { connect, disconnect, signer } =
    useAlephiumWallet();

  return (
    <>
      <ToggleConnectedButton
        connect={connect}
        disconnect={disconnect}
        connected={!!signer}
        pk={signer?.account.address || ""}
      />
    </>
  );
};

export default AlephiumWalletKey;
