import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETH
} from "@certusone/wormhole-sdk";
import {
  Box,
  Card,
  Collapse,
  Container,
  List,
  ListItem,
  ListItemText,
  makeStyles,
  MenuItem,
  TextField,
  Typography,
} from "@material-ui/core";
import { ExpandLess, ExpandMore } from "@material-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../muiTheme";
import {
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  CHAINS,
  CHAINS_WITH_NFT_SUPPORT,
} from "../utils/consts";
import { toConfirmedTx, Transaction, transactionDB, TxStatus } from "../utils/db";
import ChainSelect from "./ChainSelect";
import KeyAndBalance from "./KeyAndBalance";
import { useLiveQuery } from "dexie-react-hooks"
import { NodeProvider } from "@alephium/web3"
import { isAlphTxConfirmed } from "../utils/alephium";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";

const useStyles = makeStyles((theme) => ({
  mainCard: {
    padding: "32px 32px 16px",
    backgroundColor: COLORS.whiteWithTransparency,
  },
  list: {
    width: '100%',
    backgroundColor: theme.palette.background.paper,
  },
  nested: {
    paddingLeft: theme.spacing(4),
  },
}));

async function getTxsByStatus(
  status: TxStatus,
  sourceChainId: ChainId,
  targetChainId: ChainId
): Promise<Transaction[]> {
  return transactionDB.txs
    .where({
      "status": status,
      "sourceChainId": sourceChainId,
      "targetChainId": targetChainId
    })
    .toArray()
}

async function getTxs(sourceChainId: ChainId, targetChainId: ChainId): Promise<Transaction[]> {
  return transactionDB.txs
    .where({
      "sourceChainId": sourceChainId,
      "targetChainId": targetChainId
    })
    .toArray()
}

async function asyncFilter<T>(array: Array<T>, pred: (e: T) => Promise<Boolean>): Promise<Array<T>> {
  const promise = Promise.all(array.map(e => pred(e)))
  return promise.then((results) => array.filter((_, index) => results[index]))
}

async function updateTxStatus(nodeProvider: NodeProvider) {
  const txs = await getTxs(CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH)
  const pendingTxs = txs.filter(tx => tx.status === "Pending")
  const isTxConfirmed = async (tx: Transaction): Promise<Boolean> => {
    const status = await nodeProvider
      .transactions
      .getTransactionsStatus({txId: tx.txId})
    if (!isAlphTxConfirmed(status)) {
      return false
    }
    return status.chainConfirmations >= ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
  }
  const confirmedTxs = (await asyncFilter(pendingTxs, isTxConfirmed)).map(tx => toConfirmedTx(tx))
  await transactionDB.transaction("rw", transactionDB.txs, () => {
    transactionDB.txs
      .bulkPut(confirmedTxs)
      .catch((error) => {
        console.log("failed to update tx status, error: " + error)
      })
  })
}

function ListTransaction({status, sourceChainId, targetChainId}: {
  status: TxStatus,
  sourceChainId: ChainId,
  targetChainId: ChainId
}) {
  const classes = useStyles()
  const [open, setOpen] = useState(false)
  const { signer: alphSigner } = useAlephiumWallet()

  useEffect(() => {
    if (alphSigner) {
      const update = async () => {
        await updateTxStatus(alphSigner.nodeProvider)
      }

      update()
    }
  }, [alphSigner])

  const handleClick = () => {
    setOpen(!open)
  }

  const transactions = useLiveQuery(
    async () => getTxsByStatus(status, sourceChainId, targetChainId),
    [status, sourceChainId]
  )

  return (
    <List
      component="nav"
      className={classes.list}
    >
      <ListItem button onClick={handleClick}>
        <ListItemText primary={status + " Transactions"} />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {transactions?.map((tx: Transaction) => {
            return (
              <ListItem className={classes.nested} key={tx.txId}>
                <Typography component='div'>
                  <Box fontFamily="Monospace" fontWeight="fontWeightMedium">{tx.txId}</Box>
                </Typography>
              </ListItem>
            )
          })}
        </List>
      </Collapse>
    </List>
  );
}

// only show transactions from Alephium to ETH
export default function Transactions() {
  const classes = useStyles()
  const [type, setType] = useState<"Token" | "NFT">("Token")
  const isNFT = type === "NFT";
  const [txSourceChain, setTxSourceChain] =
    useState<ChainId>(CHAIN_ID_ALEPHIUM);

  const [txTargetChain, setTxTargetChain] =
    useState<ChainId>(CHAIN_ID_ETH)

  const handleTypeChange = useCallback((event: any) => {
    setTxSourceChain((prevChain) =>
      event.target.value === "NFT" &&
      !CHAINS_WITH_NFT_SUPPORT.find((chain) => chain.id === prevChain)
        ? CHAIN_ID_ETH
        : prevChain
    );
    setType(event.target.value);
  }, []);

  const handleSourceChainChange = useCallback((event: any) => {
    setTxSourceChain(event.target.value);
  }, []);

  const handleTargetChainChange = useCallback((event: any) => {
    setTxTargetChain(event.target.value);
  }, [])

  return (
    <Container maxWidth="md">
      <Card className={classes.mainCard}>
        <TextField
          select
          variant="outlined"
          label="Type"
          disabled={true}
          value={type}
          onChange={handleTypeChange}
          fullWidth
          margin="normal"
        >
          <MenuItem value="Token">Token</MenuItem>
          <MenuItem value="NFT">NFT</MenuItem>
        </TextField>
        <ChainSelect
          select
          variant="outlined"
          label="Source Chain"
          disabled={true}
          value={txSourceChain}
          onChange={handleSourceChainChange}
          fullWidth
          margin="normal"
          chains={isNFT ? CHAINS_WITH_NFT_SUPPORT : CHAINS}
        />
        <KeyAndBalance chainId={txSourceChain} />
        <ChainSelect
          select
          variant="outlined"
          label="Target Chain"
          disabled={true}
          value={txTargetChain}
          onChange={handleTargetChainChange}
          fullWidth
          margin="normal"
          chains={(isNFT ? CHAINS_WITH_NFT_SUPPORT : CHAINS).filter((c) => c.id !== txSourceChain)}
        />
        <KeyAndBalance chainId={txTargetChain} />
        <ListTransaction
          status="Confirmed"
          sourceChainId={txSourceChain}
          targetChainId={txTargetChain}
        />
        <ListTransaction
          status="Pending"
          sourceChainId={txSourceChain}
          targetChainId={txTargetChain}
        />
      </Card>
    </Container>
  );
}
