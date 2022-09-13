import { useMemo } from "react";
import { useSelector } from "react-redux";
import { selectAttestSignedVAAHex } from "../store/selectors";
import { hexToUint8Array } from "@h0ngcha0/wormhole-sdk";

export default function useAttestSignedVAA() {
  const signedVAAHex = useSelector(selectAttestSignedVAAHex);
  const signedVAA = useMemo(
    () => (signedVAAHex ? hexToUint8Array(signedVAAHex) : undefined),
    [signedVAAHex]
  );
  return signedVAA;
}
