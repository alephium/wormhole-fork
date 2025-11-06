import { CircularProgress } from "@mui/material";
import { makeStyles } from '@mui/styles';
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useFetchForeignAsset from "../../hooks/useFetchForeignAsset";
import { useHandleCreateWrapped } from "../../hooks/useHandleCreateWrapped";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  selectAttestSourceAsset,
  selectAttestSourceChain,
  selectAttestTargetChain,
} from "../../store/selectors";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import WaitingForWalletMessage from "./WaitingForWalletMessage";

const useStyles = makeStyles((theme) => ({
  alignCenter: {
    margin: "0 auto",
    display: "block",
    textAlign: "center",
  },
  spacer: {
    height: theme.spacing(2),
  },
}));

function Create() {
  const { t } = useTranslation();
  const classes = useStyles();
  const targetChain = useSelector(selectAttestTargetChain);
  const originAsset = useSelector(selectAttestSourceAsset);
  const originChain = useSelector(selectAttestSourceChain);
  const { isReady, statusMessage } = useIsWalletReady(targetChain);
  const foreignAssetInfo = useFetchForeignAsset(
    originChain,
    originAsset,
    targetChain
  );
  const shouldUpdate = foreignAssetInfo.data?.doesExist;
  const error = foreignAssetInfo.error || statusMessage;
  const { handleClick, disabled, showLoader } = useHandleCreateWrapped(
    shouldUpdate || false
  );

  return (
    <>
      <KeyAndBalance chainId={targetChain} />
      {foreignAssetInfo.isFetching ? (
        <>
          <div className={classes.spacer} />
          <CircularProgress className={classes.alignCenter} />
        </>
      ) : (
        <>
          <ButtonWithLoader
            disabled={!isReady || disabled}
            onClick={handleClick}
            showLoader={showLoader}
            error={error}
          >
            {shouldUpdate ? t("Update") : t("Create")}
          </ButtonWithLoader>
          <WaitingForWalletMessage />
        </>
      )}
    </>
  );
}

export default Create;
