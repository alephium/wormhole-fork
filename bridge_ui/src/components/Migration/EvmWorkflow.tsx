import { ChainId } from "@alephium/wormhole-sdk";
import { CircularProgress, makeStyles, Typography } from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { parseUnits } from "ethers/lib/utils";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import useEthereumMigratorInformation from "../../hooks/useEthereumMigratorInformation";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import ButtonWithLoader from "../ButtonWithLoader";
import EthereumSignerKey from "../EthereumSignerKey";
import NumberTextField from "../NumberTextField";
import ShowTx from "../ShowTx";
import SmartAddress from "../SmartAddress";

const useStyles = makeStyles((theme) => ({
  spacer: {
    height: "2rem",
  },
  containerDiv: {
    textAlign: "center",
    padding: theme.spacing(2),
  },
}));

export default function EvmWorkflow({
  chainId,
  migratorAddress,
}: {
  chainId: ChainId;
  migratorAddress: string;
}) {
  const { t } = useTranslation();
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const { signer, signerAddress } = useEthereumProvider();
  const { isReady } = useIsWalletReady(chainId);
  const [toggleRefresh, setToggleRefresh] = useState(false);
  const forceRefresh = useCallback(
    () => setToggleRefresh((prevState) => !prevState),
    []
  );
  const poolInfo = useEthereumMigratorInformation(
    migratorAddress,
    signer,
    signerAddress,
    toggleRefresh
  );
  const fromWalletBalance = poolInfo.data?.fromWalletBalance;

  const [migrationAmount, setMigrationAmount] = useState("");
  const [migrationIsProcessing, setMigrationIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState<string | null>(null);

  const fromParse = (amount: string) => {
    try {
      if (!poolInfo.data?.fromDecimals || !migrationAmount) {
        return BigInt(0);
      }
      return parseUnits(amount, poolInfo.data.fromDecimals).toBigInt();
    } catch (e) {
      return BigInt(0);
    }
  };

  const hasRequisiteData = poolInfo.data;
  const amountGreaterThanZero = fromParse(migrationAmount) > BigInt(0);
  const sufficientFromTokens =
    fromWalletBalance &&
    migrationAmount &&
    fromParse(migrationAmount) <= fromParse(fromWalletBalance);
  const sufficientPoolBalance =
    poolInfo.data?.toPoolBalance &&
    migrationAmount &&
    parseFloat(migrationAmount) <= parseFloat(poolInfo.data.toPoolBalance);

  const isReadyToTransfer =
    isReady &&
    amountGreaterThanZero &&
    sufficientFromTokens &&
    sufficientPoolBalance &&
    hasRequisiteData;

  const getNotReadyCause = () => {
    if (!isReady) {
      return t("Connect your wallet to proceed.");
    } else if (poolInfo.error) {
      return t("Unable to retrieve necessary information. This asset may not be supported.");
    } else if (!migrationAmount) {
      return t("Enter an amount to transfer.");
    } else if (!amountGreaterThanZero) {
      return t("The transfer amount must be greater than zero.");
    } else if (!sufficientFromTokens) {
      return t("There are not sufficient funds in your wallet for this transfer.");
    } else if (!sufficientPoolBalance) {
      return t("There are not sufficient funds in the pool for this transfer.");
    } else {
      return "";
    }
  };

  const handleAmountChange = useCallback(
    (event: any) => setMigrationAmount(event.target.value),
    [setMigrationAmount]
  );
  const handleMaxClick = useCallback(() => {
    if (fromWalletBalance) {
      setMigrationAmount(fromWalletBalance);
    }
  }, [fromWalletBalance]);

  const migrateTokens = useCallback(async () => {
    if (!poolInfo.data) {
      enqueueSnackbar(null, {
        content: <Alert severity="error">{t("Could not migrate the tokens.")}</Alert>,
      }); //Should never be hit
      return;
    }
    try {
      setMigrationIsProcessing(true);
      setError("");
      await poolInfo.data.fromToken.approve(
        poolInfo.data.migrator.address,
        parseUnits(migrationAmount, poolInfo.data.fromDecimals)
      );
      const transaction = await poolInfo.data.migrator.migrate(
        parseUnits(migrationAmount, poolInfo.data.fromDecimals)
      );
      await transaction.wait();
      setTransaction(transaction.hash);
      forceRefresh();
      enqueueSnackbar(null, {
        content: (
          <Alert severity="success">{t("Successfully migrated the tokens.")}</Alert>
        ),
      });
      setMigrationIsProcessing(false);
    } catch (e) {
      console.error(e);
      enqueueSnackbar(null, {
        content: <Alert severity="error">{t("Could not migrate the tokens.")}</Alert>,
      });
      setMigrationIsProcessing(false);
      setError(t("Failed to send the transaction."));
    }
  }, [poolInfo.data, enqueueSnackbar, t, migrationAmount, forceRefresh]);

  //TODO tokenName
  const toTokenPretty = (
    <SmartAddress
      chainId={chainId}
      address={poolInfo.data?.toAddress}
      symbol={poolInfo.data?.toSymbol}
      isAsset
    />
  );
  const fromTokenPretty = (
    <SmartAddress
      chainId={chainId}
      address={poolInfo.data?.fromAddress}
      symbol={poolInfo.data?.fromSymbol}
      isAsset
    />
  );
  const poolPretty = (
    <SmartAddress chainId={chainId} address={poolInfo.data?.poolAddress} />
  );

  const fatalError = poolInfo.error
    ? t("Unable to retrieve necessary information. This asset may not be supported.")
    : null;

  const explainerContent = (
    <div>
      <Typography>{t("This action will convert")}</Typography>
      <Typography variant="h6">
        {fromTokenPretty} {`(${t('Balance')}: ${fromWalletBalance || ""})`}
      </Typography>
      <div className={classes.spacer} />
      <Typography>{t("to")}</Typography>
      <Typography variant="h6">
        {toTokenPretty} {`(${t('Balance')}: ${poolInfo.data?.toWalletBalance || ""})`}
      </Typography>
      <div className={classes.spacer} />
      <Typography>{t("Utilizing this pool")}</Typography>
      <Typography variant="h6">
        {poolPretty} {`(${t('Balance')}: ${poolInfo.data?.toPoolBalance || ""})`}
      </Typography>
    </div>
  );

  const mainWorkflow = (
    <>
      {explainerContent}
      <div className={classes.spacer} />
      <NumberTextField
        variant="outlined"
        value={migrationAmount}
        onChange={handleAmountChange}
        label={t("Amount")}
        disabled={!!migrationIsProcessing || !!transaction}
        onMaxClick={fromWalletBalance ? handleMaxClick : undefined}
      />

      {!transaction && (
        <ButtonWithLoader
          disabled={!isReadyToTransfer || migrationIsProcessing}
          showLoader={migrationIsProcessing}
          onClick={migrateTokens}
        >
          {migrationAmount && isReadyToTransfer
            ? t('Migrate {{ tokensAmount }} Tokens', { tokensAmount: migrationAmount })
            : t('Migrate')}
        </ButtonWithLoader>
      )}

      {(error || !isReadyToTransfer) && (
        <Typography color="error">{error || getNotReadyCause()}</Typography>
      )}
      {transaction ? (
        <>
          <Typography>
            {t("Successfully migrated your tokens! They will be available once this transaction confirms.")}
          </Typography>
          <ShowTx tx={{ id: transaction, blockHeight: 1 }} chainId={chainId} />
        </>
      ) : null}
    </>
  );

  return (
    <div className={classes.containerDiv}>
      <EthereumSignerKey chainId={chainId} />
      {!isReady ? (
        <Typography variant="body1">{t("Please connect your wallet.")}</Typography>
      ) : poolInfo.isLoading ? (
        <CircularProgress />
      ) : fatalError ? (
        <Typography variant="h6">{fatalError}</Typography>
      ) : (
        mainWorkflow
      )}
    </div>
  );
}
