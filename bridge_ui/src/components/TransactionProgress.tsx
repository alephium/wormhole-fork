import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ACALA,
  CHAIN_ID_AURORA,
  CHAIN_ID_CELO,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  isEVMChain,
  CHAIN_ID_ETH,
} from "@alephium/wormhole-sdk";
import { LinearProgress, makeStyles, Typography } from "@material-ui/core";
import { Connection } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { Transaction } from "../store/transferSlice";
import { ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL, CLUSTER, CHAINS_BY_ID, SOLANA_HOST } from "../utils/consts";
import SmartBlock from "./SmartBlock";
import { DefaultEVMChainConfirmations, EpochDuration, getEVMCurrentBlockNumber, getEvmJsonRpcProvider } from "../utils/ethereum";
import { useWallet } from "@alephium/web3-react";
import { AlephiumBlockTime } from "../utils/alephium";
import { ethers } from "ethers";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: theme.spacing(2),
    textAlign: "center",
  },
  message: {
    marginTop: theme.spacing(1),
  },
}));

export default function TransactionProgress({
  chainId,
  tx,
  isSendComplete,
  consistencyLevel
}: {
  chainId: ChainId;
  tx: Transaction | undefined;
  isSendComplete: boolean;
  consistencyLevel?: number
}) {
  const { t } = useTranslation();
  const classes = useStyles();
  const { provider } = useEthereumProvider();
  const alphWallet = useWallet()
  const [currentBlock, setCurrentBlock] = useState(0);
  const [evmProvider, setEvmProvider] = useState<ethers.providers.Provider | undefined>(provider)
  const [lastBlockUpdatedTs, setLastBlockUpdatedTs] = useState(Date.now())
  const [alphTxConfirmedTs, setAlphTxConfirmedTs] = useState<number | undefined>()
  const [alphTxConfirmed, setAlphTxConfirmed] = useState<boolean>(false)
  useEffect(() => {
    if (chainId !== CHAIN_ID_ALEPHIUM) return

    const confirmations = consistencyLevel ?? ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
    const now = Date.now()
    const confirmedTimestamp = (tx?.blockTimestamp ?? now) + (confirmations * AlephiumBlockTime)
    setAlphTxConfirmedTs(confirmedTimestamp)
    setTimeout(() => setAlphTxConfirmed(true), confirmedTimestamp > now ? confirmedTimestamp - now : 0)
  }, [setAlphTxConfirmedTs, setAlphTxConfirmed, tx?.blockTimestamp, chainId, consistencyLevel])

  useEffect(() => {
    if (isSendComplete || !tx) return;
    if (isEVMChain(chainId) && evmProvider) {
      let cancelled = false;
      (async () => {
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            const newBlock = await getEVMCurrentBlockNumber(evmProvider, chainId)
            if (!cancelled) {
              setCurrentBlock((prev) => {
                const now = Date.now()
                if (prev === newBlock && (now - lastBlockUpdatedTs > EpochDuration) && evmProvider === provider) {
                  setEvmProvider(getEvmJsonRpcProvider(chainId))
                } else if (prev !== newBlock) {
                  setLastBlockUpdatedTs(now)
                }
                return newBlock
              });
            }
          } catch (e) {
            console.error(e);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (chainId === CHAIN_ID_SOLANA) {
      let cancelled = false;
      const connection = new Connection(SOLANA_HOST, "confirmed");
      const sub = connection.onSlotChange((slotInfo) => {
        if (!cancelled) {
          setCurrentBlock(slotInfo.slot);
        }
      });
      return () => {
        cancelled = true;
        connection.removeSlotChangeListener(sub);
      };
    }
    if (chainId === CHAIN_ID_ALEPHIUM && alphWallet?.nodeProvider !== undefined) {
      let cancelled = false;
      (async (nodeProvider) => {
        while (!cancelled) {
          const timeout = CLUSTER === "devnet" ? 1000 : 10000
          await new Promise((resolve) => setTimeout(resolve, timeout));
          try {
            const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo({
              fromGroup: alphWallet.account.group,
              toGroup: alphWallet.account.group
            });
            if (!cancelled) {
              setCurrentBlock(chainInfo.currentHeight);
            }
          } catch (e) {
            console.error(e)
          }
        }
      })(alphWallet.nodeProvider);
      return () => {
        cancelled = true;
      };
    }
  }, [isSendComplete, chainId, provider, alphWallet, tx, lastBlockUpdatedTs, evmProvider]);
  if (chainId === CHAIN_ID_ALEPHIUM) {
    const blockDiff =
      tx && tx.blockHeight && currentBlock ? currentBlock - tx.blockHeight : undefined;
    const remainMinutes = alphTxConfirmedTs === undefined ? undefined : getRemainMinutes(alphTxConfirmedTs)
    const expectedBlocks = consistencyLevel ?? ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
    const chainName = CHAINS_BY_ID[chainId].name
    if (!isSendComplete && blockDiff !== undefined) {
      return (
        <div className={classes.root}>
          <LinearProgress
            value={
              blockDiff < expectedBlocks ? (blockDiff / expectedBlocks) * 75 : 75
            }
            variant="determinate"
          />
          <Typography variant="body2" className={classes.message}>
            {blockDiff < expectedBlocks
              ? `${t('Waiting for {{ blockDiff }} / {{ expectedBlocks }} confirmations on {{ chainName }}', { blockDiff, expectedBlocks, chainName })}...`
              : !alphTxConfirmed && !!remainMinutes
              ? `${t('Waiting for confirmations on {{ chainName }}, {{ minutes }} minutes remaining', { chainName, minutes: remainMinutes.toFixed(2) })}...`
              : `${t('Waiting for Wormhole Network consensus')}...`}
          </Typography>
        </div>
      );
    }
  } else if (chainId === CHAIN_ID_ETH && CLUSTER !== 'devnet') {
    if (!isSendComplete && tx && tx.blockHeight && currentBlock) {
      const isFinalized = currentBlock >= tx.blockHeight;
      return (
        <div className={classes.root}>
          <Typography variant="body2" className={classes.message}>
            {!isFinalized
              ? `${t('Waiting for finality on {{ chainName }} which may take up to 15 minutes.', { chainName: CHAINS_BY_ID[chainId].name })}`
              : `${t('Waiting for Wormhole Network consensus')}...`}
          </Typography>
          {!isFinalized ? (
            <>
              <span>{t("Last finalized block number")}</span>
              <SmartBlock chainId={chainId} blockNumber={currentBlock} />
              <span></span>
              <SmartBlock chainId={chainId} blockNumber={tx.blockHeight} />
            </>
          ) : null}
        </div>
      );
    }
  } else {
    const blockDiff =
      tx && tx.blockHeight && currentBlock ? currentBlock - tx.blockHeight : undefined;
    // minimum confirmations enforced by guardians or specified by the contract
    const expectedBlocks = consistencyLevel ?? (
      chainId === CHAIN_ID_POLYGON
        ? CLUSTER === "testnet"
          ? 64
          : 512
        : chainId === CHAIN_ID_OASIS ||
          chainId === CHAIN_ID_AURORA ||
          chainId === CHAIN_ID_FANTOM ||
          chainId === CHAIN_ID_KARURA ||
          chainId === CHAIN_ID_ACALA ||
          chainId === CHAIN_ID_KLAYTN ||
          chainId === CHAIN_ID_CELO
        ? 1 // these chains only require 1 conf
        : chainId === CHAIN_ID_SOLANA
        ? 32
        : isEVMChain(chainId)
        ? DefaultEVMChainConfirmations
        : 1);
    if (
      !isSendComplete &&
      (chainId === CHAIN_ID_SOLANA || isEVMChain(chainId)) &&
      blockDiff !== undefined
    ) {
      const chainName = CHAINS_BY_ID[chainId].name
      return (
        <div className={classes.root}>
          <LinearProgress
            value={
              blockDiff < expectedBlocks ? (blockDiff / expectedBlocks) * 75 : 75
            }
            variant="determinate"
          />
          <Typography variant="body2" className={classes.message}>
            {blockDiff < expectedBlocks
              ? `${t('Waiting for {{ blockDiff }} / {{ expectedBlocks }} confirmations on {{ chainName }}', { blockDiff, expectedBlocks, chainName })}...`
              : `${t('Waiting for Wormhole Network consensus')}...`}
          </Typography>
        </div>
      );
    }
  }
  return null;
}

function getRemainMinutes(confirmedTimestamp: number): number {
  const now = Date.now()
  return now < confirmedTimestamp ? ((confirmedTimestamp - now) / 60000) : 0
}
