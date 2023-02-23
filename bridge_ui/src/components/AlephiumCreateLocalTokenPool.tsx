import { extractPayloadFromVAA, waitAlphTxConfirmed } from "alephium-wormhole-sdk";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  makeStyles,
  Typography,
} from "@material-ui/core";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { CHAINS_BY_ID } from "../utils/consts";
import { selectAttestTargetChain } from "../store/selectors"
import { useAlephiumWallet } from "../hooks/useAlephiumWallet";
import { Alert } from "@material-ui/lab";
import { createLocalTokenPool } from "../utils/alephium";
import { binToHex } from "@alephium/web3";

const useStyles = makeStyles((theme) => ({
  container: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  alert: {
    textAlign: "center",
  },
  line: {
    marginBottom: theme.spacing(2),
  },
}));

function CreateLocalTokenPool({
  signedVAAHex,
  onClose,
  onClick,
}: {
  signedVAAHex: string | undefined,
  onClose: () => void;
  onClick: () => void;
}) {
  const alphWallet = useAlephiumWallet()
  const targetChain = useSelector(selectAttestTargetChain)
  const chainName = CHAINS_BY_ID[targetChain].name
  const classes = useStyles()
  const onConfirmed = useCallback(async () => {
    onClick()
    if (alphWallet !== undefined && signedVAAHex !== undefined) {
      const signedVAA = Buffer.from(signedVAAHex, 'hex')
      const payload = extractPayloadFromVAA(signedVAA)
      const tokenId = binToHex(payload.slice(1, 33))
      const createLocalTokenPoolTxId = await createLocalTokenPool(
        alphWallet.signer,
        alphWallet.nodeProvider,
        alphWallet.address,
        tokenId,
        Buffer.from(signedVAAHex, 'hex')
      )
      if (createLocalTokenPoolTxId !== undefined) {
        console.log(`create local token pool tx id: ${createLocalTokenPoolTxId}`)
        await waitAlphTxConfirmed(alphWallet.nodeProvider, createLocalTokenPoolTxId, 1)
      }
    }
  }, [onClick, alphWallet, signedVAAHex])

  const confirmationContent = (
    <>
      <DialogTitle>Attest token from Alephium to {chainName}</DialogTitle>
      <DialogContent>
        {
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Typography variant="subtitle1" style={{ marginBottom: 8 }}>
              You also need to create token pool on Alephium chain.
            </Typography>
          </div>
        }
        <Alert severity="warning" variant="outlined" className={classes.alert}>
          You can not transfer to other chains if you don't create the token pool on Alephium.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={async () => await onConfirmed()}
          size={"medium"}
          disabled={false}
        >
          Confirm
        </Button>
      </DialogActions>
    </>
  );

  return confirmationContent;
}

export default function AlephiumCreateLocalTokenPool({
  open,
  signedVAAHex,
  onClick,
  onClose,
}: {
  open: boolean;
  signedVAAHex: string | undefined;
  onClick: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <CreateLocalTokenPool
        signedVAAHex={signedVAAHex}
        onClose={onClose}
        onClick={onClick}
      />
    </Dialog>
  );
}
