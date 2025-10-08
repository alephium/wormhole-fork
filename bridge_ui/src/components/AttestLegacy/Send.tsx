import { CHAIN_ID_ALEPHIUM, CHAIN_ID_SOLANA, waitAlphTxConfirmed } from "@alephium/wormhole-sdk";
import { Alert } from "@material-ui/lab";
import { Link, makeStyles } from "@material-ui/core";
import { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHandleAttest } from "../../hooks/useHandleAttest";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import useMetaplexData from "../../hooks/useMetaplexData";
import {
  selectAttestAttestTx,
  selectAttestIsSendComplete,
  selectAttestSignedVAAHex,
  selectAttestSourceAsset,
  selectAttestSourceChain
} from "../../store/selectors";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import TransactionProgress from "../TransactionProgress";
import WaitingForWalletMessage from "./WaitingForWalletMessage";
import { ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL, SOLANA_TOKEN_METADATA_PROGRAM_URL } from "../../utils/consts";
import { createLocalTokenPool } from "../../utils/alephium";
import { useWallet } from "@alephium/web3-react";
import { useSnackbar } from "notistack";
import { setStep } from "../../store/attestSlice";
import { Trans, useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  alert: {
    marginTop: theme.spacing(1),
  },
}));

const SolanaTokenMetadataWarning = () => {
  const { t } = useTranslation();
  const sourceAsset = useSelector(selectAttestSourceAsset);
  const sourceAssetArrayed = useMemo(() => {
    return [sourceAsset];
  }, [sourceAsset]);
  const metaplexData = useMetaplexData(sourceAssetArrayed);
  const classes = useStyles();

  if (metaplexData.isFetching || metaplexData.error) {
    return null;
  }

  return !metaplexData.data?.get(sourceAsset) ? (
    <Alert severity="warning" variant="outlined" className={classes.alert}>
      <Trans
        t={t}
        i18nKey="missingMetaplexMetadata"
        components={{
          1: <Link href={SOLANA_TOKEN_METADATA_PROGRAM_URL} target="_blank" rel="noopener noreferrer" />
        }}
      >
        {"This token is missing on-chain (Metaplex) metadata. Without it, the wrapped token's name and symbol will be empty. See the <1>metaplex repository</1>for details."}
      </Trans>
    </Alert>
  ) : null;
};

function CreateLocalTokenPool({ localTokenId }: { localTokenId: string }) {
  const { t } = useTranslation()
  const alphWallet = useWallet()
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()
  const signedVAAHex = useSelector(selectAttestSignedVAAHex)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>()
  const onClick = useCallback(async () => {
    if (signedVAAHex !== undefined && alphWallet?.nodeProvider !== undefined) {
      try {
        setIsSending(true)
        const createLocalTokenPoolTxId = await createLocalTokenPool(
          alphWallet.signer,
          alphWallet.nodeProvider,
          alphWallet.account.address,
          localTokenId,
          Buffer.from(signedVAAHex, 'hex')
        )
        if (createLocalTokenPoolTxId !== undefined) {
          await waitAlphTxConfirmed(alphWallet.nodeProvider, createLocalTokenPoolTxId, 1)
          console.log(`create local token pool tx id: ${createLocalTokenPoolTxId}`)
          enqueueSnackbar(null, {
            content: <Alert severity="success">{t("Transaction confirmed")}</Alert>
          })
        } else {
          enqueueSnackbar(null, {
            content: <Alert severity="info">{t("Local token pool already exists")}</Alert>
          })
        }
      } catch (error) {
        setError(`${error}`)
      }

      setIsSending(false)
      dispatch(setStep(3))
    }
  }, [alphWallet, signedVAAHex, enqueueSnackbar, localTokenId, dispatch, t])
  const isReady = signedVAAHex !== undefined && alphWallet !== undefined && !isSending

  return (
    <>
      <ButtonWithLoader
        disabled={!isReady}
        onClick={onClick}
        showLoader={isSending}
        error={error}
      >
        {isSending ? `${t('Waiting for transaction confirmation')}...` : t('Create Local Token Pool')}
      </ButtonWithLoader>
    </>
  )
}

function Send() {
  const { t } = useTranslation();
  const { handleClick, disabled, showLoader } = useHandleAttest();
  const sourceChain = useSelector(selectAttestSourceChain);
  const sourceAsset = useSelector(selectAttestSourceAsset);
  const attestTx = useSelector(selectAttestAttestTx);
  const isSendComplete = useSelector(selectAttestIsSendComplete);
  const { isReady, statusMessage } = useIsWalletReady(sourceChain);

  return (
    <>
      <KeyAndBalance chainId={sourceChain} />
      <ButtonWithLoader
        disabled={!isReady || disabled}
        onClick={handleClick}
        showLoader={showLoader}
        error={statusMessage}
      >
        {t("Attest")}
      </ButtonWithLoader>
      {sourceChain === CHAIN_ID_SOLANA && <SolanaTokenMetadataWarning />}
      <WaitingForWalletMessage />
      <TransactionProgress
        chainId={sourceChain}
        tx={attestTx}
        isSendComplete={isSendComplete}
        consistencyLevel={sourceChain === CHAIN_ID_ALEPHIUM ? ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL : undefined}
      />
      { sourceChain === CHAIN_ID_ALEPHIUM && <CreateLocalTokenPool localTokenId={sourceAsset}/> }
    </>
  );
}

export default Send;
