import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_FANTOM,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import { LinearProgress, makeStyles, Typography } from "@material-ui/core";
import { CliqueClient } from "alephium-web3";
import { useEffect, useState } from "react";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { Transaction } from "../store/transferSlice";
import { ALEPHIUM_CONFIRMATIONS, ALEPHIUM_GROUP_INDEX, ALEPHIUM_HOST, CHAINS_BY_ID } from "../utils/consts";

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
}: {
  chainId: ChainId;
  tx: Transaction | undefined;
  isSendComplete: boolean;
}) {
  const classes = useStyles();
  const { provider } = useEthereumProvider();
  const [currentBlock, setCurrentBlock] = useState(0);
  useEffect(() => {
    if (isSendComplete || !tx) return;
    if (isEVMChain(chainId) && provider) {
      let cancelled = false;
      (async () => {
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          try {
            const newBlock = await provider.getBlockNumber();
            if (!cancelled) {
              setCurrentBlock(newBlock);
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
    if (chainId === CHAIN_ID_ALEPHIUM) {
      let cancelled = false;
      const client = new CliqueClient({baseUrl: ALEPHIUM_HOST});
      (async () => {
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          try {
            const chainInfo = await client.blockflow.getBlockflowChainInfo({
              fromGroup: ALEPHIUM_GROUP_INDEX,
              toGroup: ALEPHIUM_GROUP_INDEX
            });
            if (!cancelled) {
              setCurrentBlock(chainInfo.data.currentHeight);
            }
          } catch (e) {
            console.error(e)
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [isSendComplete, chainId, provider, tx]);
  const blockDiff =
    tx && tx.block && currentBlock ? currentBlock - tx.block : undefined;
  const expectedBlocks =
    chainId === CHAIN_ID_POLYGON
      ? 512 // minimum confirmations enforced by guardians
      : chainId === CHAIN_ID_FANTOM || chainId === CHAIN_ID_OASIS
      ? 1 // these chains only require 1 conf
      : isEVMChain(chainId)
      ? 15
      : chainId === CHAIN_ID_ALEPHIUM
      ? ALEPHIUM_CONFIRMATIONS
      : 1;
  if (
    !isSendComplete &&
    isEVMChain(chainId) &&
    blockDiff !== undefined
  ) {
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
            ? `Waiting for ${blockDiff} / ${expectedBlocks} confirmations on ${CHAINS_BY_ID[chainId].name}...`
            : `Waiting for Wormhole Network consensus...`}
        </Typography>
      </div>
    );
  }
  return null;
}
