import { CHAIN_ID_TERRA } from "@certusone/wormhole-sdk";
import { useSelector } from "react-redux";
import { useHandleAttest } from "../../hooks/useHandleAttest";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  selectAttestAttestTx,
  selectAttestIsSendComplete,
  selectAttestSourceChain,
} from "../../store/selectors";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import TransactionProgress from "../TransactionProgress";
import WaitingForWalletMessage from "./WaitingForWalletMessage";
import TerraFeeDenomPicker from "../TerraFeeDenomPicker";

function Send() {
  const { handleClick, disabled, showLoader } = useHandleAttest();
  const sourceChain = useSelector(selectAttestSourceChain);
  const attestTx = useSelector(selectAttestAttestTx);
  const isSendComplete = useSelector(selectAttestIsSendComplete);
  const { isReady, statusMessage } = useIsWalletReady(sourceChain);

  return (
    <>
      <KeyAndBalance chainId={sourceChain} />
      {sourceChain === CHAIN_ID_TERRA && (
        <TerraFeeDenomPicker disabled={disabled} />
      )}
      <ButtonWithLoader
        disabled={!isReady || disabled}
        onClick={handleClick}
        showLoader={showLoader}
        error={statusMessage}
      >
        Attest
      </ButtonWithLoader>
      <WaitingForWalletMessage />
      <TransactionProgress
        chainId={sourceChain}
        tx={attestTx}
        isSendComplete={isSendComplete}
      />
    </>
  );
}

export default Send;
