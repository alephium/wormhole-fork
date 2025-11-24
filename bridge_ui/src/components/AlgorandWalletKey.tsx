import { useAlgorandContext } from "@alephium/bridge-widget";
import ToggleConnectedButton from "./ToggleConnectedButton";

const AlgorandWalletKey = () => {
  const { connect, disconnect, accounts } = useAlgorandContext();

  return (
    <>
      <ToggleConnectedButton
        connect={connect}
        disconnect={disconnect}
        connected={!!accounts[0]}
        pk={accounts[0]?.address || ""}
      />
    </>
  );
};

export default AlgorandWalletKey;
