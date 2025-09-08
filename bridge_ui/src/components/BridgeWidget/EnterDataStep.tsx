import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  ChainId,
  isEVMChain,
} from "@alephium/wormhole-sdk";
import { getAddress } from "@ethersproject/address";
import { Button, makeStyles } from "@material-ui/core";

import { useCallback, useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router";

import useIsWalletReady from "../../hooks/useIsWalletReady";

import {
  selectTransferIsSourceComplete,
  selectTransferShouldLockFields,
  selectTransferSourceBalanceString,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetChain,
} from "../../store/selectors";
import { setSourceChain, setTargetChain } from "../../store/transferSlice";
import {
  BSC_MIGRATION_ASSET_MAP,
  CHAINS,
  CHAINS_BY_ID,
  ETH_MIGRATION_ASSET_MAP,
  getIsTransferDisabled,
} from "../../utils/consts";
import LowBalanceWarning from "../LowBalanceWarning";
import SourceAssetWarning from "../Transfer/SourceAssetWarning";
import ChainWarningMessage from "../ChainWarningMessage";
import { useTranslation } from "react-i18next";
import { TokenSelector2 } from "./SourceTokenSelector2";
import ChainSelect2 from "../ChainSelect2";
import ChainSelectArrow2 from "./ChainSelectArrow2";
import useSyncTargetAddress from "../../hooks/useSyncTargetAddress";
import useGetTargetParsedTokenAccounts from "../../hooks/useGetTargetParsedTokenAccounts";
import EvmConnectWalletDialog from "../EvmConnectWalletDialog";
import { AlephiumConnectButton } from "@alephium/web3-react";
import BridgeWidgetButton from "./BridgeWidgetButton";

// Copied from Source.tsx

interface EnterDataStepProps {
  onNext: () => void;
}

const EnterDataStep = ({ onNext }: EnterDataStepProps) => {
  const { t } = useTranslation();
  const classes = useStyles();
  const dispatch = useDispatch();
  const history = useHistory();
  const sourceChain = useSelector(selectTransferSourceChain);
  const targetChain = useSelector(selectTransferTargetChain);
  const targetChainOptions = useMemo(() => CHAINS.filter((c) => c.id !== sourceChain), [sourceChain]);
  const parsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount);
  const isEthereumMigration =
    sourceChain === CHAIN_ID_ETH &&
    !!parsedTokenAccount &&
    !!ETH_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey));
  const isBscMigration =
    sourceChain === CHAIN_ID_BSC &&
    !!parsedTokenAccount &&
    !!BSC_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey));
  const isMigrationAsset = isEthereumMigration || isBscMigration;
  const uiAmountString = useSelector(selectTransferSourceBalanceString);
  const shouldLockFields = useSelector(selectTransferShouldLockFields);
  const { isReady } = useIsWalletReady(sourceChain);

  useGetTargetParsedTokenAccounts();
  useSyncTargetAddress(!shouldLockFields);

  const handleMigrationClick = useCallback(() => {
    if (sourceChain === CHAIN_ID_SOLANA) {
      history.push(`/migrate/Solana/${parsedTokenAccount?.mintKey}/${parsedTokenAccount?.publicKey}`);
    } else if (sourceChain === CHAIN_ID_ETH) {
      history.push(`/migrate/Ethereum/${parsedTokenAccount?.mintKey}`);
    } else if (sourceChain === CHAIN_ID_BSC) {
      history.push(`/migrate/BinanceSmartChain/${parsedTokenAccount?.mintKey}`);
    }
  }, [history, parsedTokenAccount, sourceChain]);

  const handleSourceChange = useCallback(
    (event: any) => {
      dispatch(setSourceChain(event.target.value));
    },
    [dispatch]
  );

  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value));
    },
    [dispatch]
  );

  return (
    <>
      <div className={classes.chainSelectWrapper}>
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="From"
            select
            variant="outlined"
            fullWidth
            value={sourceChain}
            onChange={handleSourceChange}
            disabled={shouldLockFields}
            chains={CHAINS}
          />
        </div>
        <div className={classes.chainSelectArrow}>
          <ChainSelectArrow2
            onClick={() => {
              dispatch(setSourceChain(targetChain));
            }}
            disabled={shouldLockFields}
          />
        </div>
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="To"
            variant="outlined"
            select
            fullWidth
            value={targetChain}
            onChange={handleTargetChange}
            disabled={shouldLockFields}
            chains={targetChainOptions}
          />
        </div>
      </div>

      {isReady || uiAmountString ? <TokenSelector2 disabled={shouldLockFields} /> : null}

      {isMigrationAsset ? (
        <Button variant="contained" color="primary" fullWidth onClick={handleMigrationClick}>
          {t("Go to Migration Page")}
        </Button>
      ) : (
        <>
          <LowBalanceWarning chainId={sourceChain} />
          <SourceAssetWarning sourceChain={sourceChain} sourceAsset={parsedTokenAccount?.mintKey} />
          <ChainWarningMessage chainId={sourceChain} />
          <ChainWarningMessage chainId={targetChain} />
        </>
      )}

      <NextActionButton onNext={onNext} />
    </>
  );
};

export default EnterDataStep;

const NextActionButton = ({ onNext }: EnterDataStepProps) => {
  const { t } = useTranslation();
  const sourceChain = useSelector(selectTransferSourceChain);
  const targetChain = useSelector(selectTransferTargetChain);
  const { isReady: isSourceReady } = useIsWalletReady(sourceChain);
  const { isReady: isTargetReady } = useIsWalletReady(targetChain);
  const isSourceComplete = useSelector(selectTransferIsSourceComplete);
  const isSourceTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(sourceChain, true);
  }, [sourceChain]);
  const isTargetTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(targetChain, false);
  }, [targetChain]);

  if (!isSourceReady) {
    return <ConnectButton chainId={sourceChain} />;
  }

  if (!isTargetReady) {
    return <ConnectButton chainId={targetChain} />;
  }

  return (
    <BridgeWidgetButton
      disabled={!isSourceComplete || isSourceTransferDisabled || isTargetTransferDisabled}
      onClick={onNext}
    >
      {t("Next")}
    </BridgeWidgetButton>
  );
};

const ConnectButton = ({ chainId }: { chainId: ChainId }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => {
    setIsOpen(true);
  };
  const closeDialog = () => {
    setIsOpen(false);
  };

  if (isEVMChain(chainId)) {
    return (
      <>
        <BridgeWidgetButton onClick={openDialog}>Connect {CHAINS_BY_ID[chainId].name} wallet</BridgeWidgetButton>
        <EvmConnectWalletDialog isOpen={isOpen} onClose={closeDialog} chainId={chainId} />
      </>
    );
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show }) => {
          return <BridgeWidgetButton onClick={show}>Connect Alephium wallet</BridgeWidgetButton>;
        }}
      </AlephiumConnectButton.Custom>
    );
  }

  return null;
};

const useStyles = makeStyles((theme) => ({
  chainSelectWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    gap: "5px",
  },
  chainSelectContainer: {
    flexBasis: "100%",
    width: "100%",
  },

  chainSelectArrow: {
    position: "absolute",
    top: "calc(50% - 23px)",
    transform: "rotate(90deg)",
  },
}));
