import { CHAIN_ID_SOLANA } from "@alephium/wormhole-sdk";
import { useSelector } from "react-redux";
import { useHandleNFTRedeem } from "../../hooks/useHandleNFTRedeem";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import { selectNFTTargetChain } from "../../store/selectors";
import { CLUSTER } from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import SolanaTPSWarning from "../SolanaTPSWarning";
import StepDescription from "../StepDescription";
import WaitingForWalletMessage from "./WaitingForWalletMessage";

function Redeem() {
  const { handleClick, disabled, showLoader } = useHandleNFTRedeem();
  const targetChain = useSelector(selectNFTTargetChain);
  const { isReady, statusMessage } = useIsWalletReady(targetChain);
  return (
    <>
      <StepDescription>Receive the NFT on the target chain</StepDescription>
      <KeyAndBalance chainId={targetChain} />
      {targetChain === CHAIN_ID_SOLANA && CLUSTER === "mainnet" && (
        <SolanaTPSWarning />
      )}
      <ButtonWithLoader
        disabled={!isReady || disabled}
        onClick={handleClick}
        showLoader={showLoader}
        error={statusMessage}
      >
        Redeem
      </ButtonWithLoader>
      <WaitingForWalletMessage />
    </>
  );
}

export default Redeem;
