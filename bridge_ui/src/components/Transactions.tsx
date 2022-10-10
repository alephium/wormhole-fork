import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETH,
  getIsTransferCompletedEth
} from "alephium-wormhole-sdk";
import {
  Box,
  Card,
  CircularProgress,
  Collapse,
  Container,
  List,
  ListItem,
  ListItemText,
  makeStyles,
  MenuItem,
  TextField,
  Typography
} from "@material-ui/core";
import { ExpandLess, ExpandMore } from "@material-ui/icons";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../muiTheme";
import {
  ALEPHIUM_BRIDGE_ADDRESS,
  ALEPHIUM_EXPLORER_HOST,
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  CHAINS,
  CHAINS_WITH_NFT_SUPPORT,
  getTokenBridgeAddressForChain
} from "../utils/consts";
import { Transaction, TransactionDB, TxStatus } from "../utils/db";
import ChainSelect from "./ChainSelect";
import KeyAndBalance from "./KeyAndBalance";
import { useLiveQuery } from "dexie-react-hooks"
import { NodeProvider, ExplorerProvider, explorer } from "@alephium/web3"
import { isAlphTxConfirmed, isAlphTxNotFound } from "../utils/alephium";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import useIsWalletReady from "../hooks/useIsWalletReady";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { Alert } from "@material-ui/lab";
import ButtonWithLoader from "./ButtonWithLoader";

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
  loader: {
    marginLeft: theme.spacing(50)
  },
  error: {
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
  info: {
    marginTop: theme.spacing(1),
  },
}));

async function getTxsByStatus(
  status: TxStatus,
  sourceChainId: ChainId,
  targetChainId: ChainId
): Promise<Transaction[]> {
  return TransactionDB.getInstance().txs
    .where({
      "status": status,
      "sourceChainId": sourceChainId,
      "targetChainId": targetChainId
    })
    .toArray()
}

interface TxIdAndSequence {
  txId: string
  sequence: string
}

async function getBridgeTransferTxInfo(
  nodeProvider: NodeProvider,
  tx: explorer.Transaction
): Promise<TxIdAndSequence | undefined> {
  if (typeof tx.inputs === 'undefined' || tx.inputs.length === 0) {
    return undefined
  }
  const haveContractInput = tx.inputs.some(input => typeof input.unlockScript === 'undefined')
  if (!haveContractInput) {
    return undefined
  }
  const events = await nodeProvider.events.getEventsTxIdTxid(tx.hash)
  const event = events.events.find(event => event.contractAddress === ALEPHIUM_BRIDGE_ADDRESS)
  if (typeof event === 'undefined') {
    return undefined
  }
  const payload = event.fields[4].value as string
  if (!payload.startsWith("01")) { // transfer payload id
    return undefined
  }
  const sequence = event.fields[2].value as string
  return {txId: tx.hash, sequence: sequence}
}

interface SyncInfo {
  syncing: boolean
  loadedTxNum: number
  bridgeTxs: Transaction[]
}

async function getTxsFromExplorer(
  explorerProvider: ExplorerProvider,
  nodeProvider: NodeProvider,
  address: string,
  targetChainId: ChainId,
  isTransferCompleted: (sequence: string) => Promise<boolean>,
  fromPage: number,
  limit: number,
): Promise<SyncInfo> {
  const response = await explorerProvider.addresses.getAddressesAddressTransactions(address, {page: fromPage, limit: limit})
  const bridgeTxs: TxIdAndSequence[] = []
  for (const tx of response) {
    const transferTxInfo = await getBridgeTransferTxInfo(nodeProvider, tx)
    if (typeof transferTxInfo !== 'undefined') {
      bridgeTxs.push(transferTxInfo)
    }
  }

  const txsStatus = await Promise.all(
    bridgeTxs.map(tx => nodeProvider.transactions.getTransactionsStatus({txId: tx.txId}))
  )
  const txs: Transaction[] = []
  const toTransaction = (txId: string, sequence: string, status: TxStatus): Transaction => {
    return new Transaction(txId, address, CHAIN_ID_ALEPHIUM, targetChainId, sequence, status)
  }

  for (let index = 0; index < bridgeTxs.length; index++) {
    const tx = bridgeTxs[index]
    const status = txsStatus[index]
    // txs synchronized from the explorer are all from the main chain
    if (isAlphTxConfirmed(status) && status.chainConfirmations < ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL) {
      txs.push(toTransaction(tx.txId, tx.sequence, "Pending"))
      continue
    }
    const isCompleted = await isTransferCompleted(tx.sequence)
    if (isCompleted) {
      txs.push(toTransaction(tx.txId, tx.sequence, "Completed"))
    } else {
      txs.push(toTransaction(tx.txId, tx.sequence, "Confirmed"))
    }
  }

  if (response.length < limit) {
    // sync completed
    return {
      syncing: false,
      loadedTxNum: response.length,
      bridgeTxs: txs
    }
  }
  return {
    syncing: true,
    loadedTxNum: response.length,
    bridgeTxs: txs
  }
}

async function syncFromExplorer(
  nodeProvider: NodeProvider,
  address: string,
  targetChainId: ChainId,
  isTransferCompleted: (sequence: string) => Promise<boolean>,
  fromPage: number,
  limit: number = 20
): Promise<SyncInfo> {
  const explorerProvider = new ExplorerProvider(ALEPHIUM_EXPLORER_HOST)
  const syncInfo = await getTxsFromExplorer(
    explorerProvider,
    nodeProvider,
    address,
    targetChainId,
    isTransferCompleted,
    fromPage,
    limit
  )
  if (syncInfo.bridgeTxs.length > 0) {
    await TransactionDB.getInstance().txs.bulkPut(syncInfo.bridgeTxs)
  }
  return syncInfo
}

async function updateTxStatus(nodeProvider: NodeProvider, targetChainId: ChainId) {
  const pendingTxs = await getTxsByStatus("Pending", CHAIN_ID_ALEPHIUM, targetChainId)
  const pendingTxsStatus = await Promise.all(
    pendingTxs.map((tx) => nodeProvider.transactions.getTransactionsStatus({txId: tx.txId}))
  )
  const removedTxs: string[] = []
  const confirmedTxs: Transaction[] = []
  pendingTxs.forEach((tx, index) => {
    const txStatus = pendingTxsStatus[index]
    if (isAlphTxNotFound(txStatus)) {
      removedTxs.push(tx.txId)
    } else if (isAlphTxConfirmed(txStatus) && txStatus.chainConfirmations >= ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL) {
      tx.status = "Confirmed"
      confirmedTxs.push(tx)
    }
  })
  const transactionDB = TransactionDB.getInstance()
  await transactionDB.transaction("rw", transactionDB.txs, () => {
    transactionDB.txs
      .bulkPut(confirmedTxs)
      .then(_ => transactionDB.txs.bulkDelete(removedTxs))
  }).catch(error => {
    console.log("failed to update txs status, error: " + error)
  })
}

function ListTransaction({status, sourceChainId, targetChainId}: {
  status: TxStatus,
  sourceChainId: ChainId,
  targetChainId: ChainId
}) {
  const classes = useStyles()
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    setOpen(!open)
  }
  const transactions = useLiveQuery(
    async () => await getTxsByStatus(status, sourceChainId, targetChainId),
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
        <List
          component="div" disablePadding
          style={{maxHeight:200, overflow: 'auto'}}
        >
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

  const [pageNumber, setPageNumber] = useState<number>(1)
  const [syncInfo, setSyncInfo] = useState<SyncInfo | undefined>(undefined)
  const [resync, setResync] = useState<boolean>(false)

  const { isReady: sourceChainReady } = useIsWalletReady(txSourceChain)
  const { isReady: targetChainReady } = useIsWalletReady(txTargetChain)

  const { signer: alphSigner } = useAlephiumWallet()
  const { provider: ethProvider } = useEthereumProvider()
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<any>(null)

  const isTransferCompleted = useCallback(async (sequence: string) => {
    if (ethProvider && txTargetChain === CHAIN_ID_ETH) {
      const response = await getSignedVAAWithRetry(
        CHAIN_ID_ALEPHIUM,
        ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
        CHAIN_ID_ETH,
        sequence
      )
      return getIsTransferCompletedEth(
        getTokenBridgeAddressForChain(CHAIN_ID_ETH),
        ethProvider,
        response.vaaBytes
      )
    }
    throw Error("Only support ETH as target chain")
  }, [ethProvider, txTargetChain])

  // load more transactions from explorer
  const loadMoreTxsCallback = useCallback(async () => {
    if (alphSigner) {
      setPageNumber(pageNumber + 1)
      setIsLoading(true)
      syncFromExplorer(
        alphSigner.nodeProvider,
        alphSigner.account.address,
        txTargetChain,
        isTransferCompleted,
        pageNumber + 1
      ).then(syncInfo => {
        setIsLoading(false)
        setResync(false)
        setSyncInfo(syncInfo)
      }).catch(error => {
        setIsLoading(false)
        setResync(false)
        setLoadingError(error)
      })
    }
  }, [
    pageNumber,
    alphSigner,
    txTargetChain,
    isTransferCompleted
  ])

  // resync from the explorer
  const resyncCallback = useCallback(async () => {
    setSyncInfo(undefined)
    setResync(true)
    setPageNumber(1)
    await TransactionDB.delete()
  }, [])

  useEffect(() => {
    if (alphSigner && ethProvider) {
      const update = async () => {
        const dbExist = await TransactionDB.exists()
        if (dbExist && typeof syncInfo === 'undefined') {
          setIsLoading(true)
          await updateTxStatus(alphSigner.nodeProvider, txTargetChain)
            .then(_ => {
              setIsLoading(false)
            })
            .catch(error => {
              setIsLoading(false)
              setLoadingError(error)
            })
        }
      }
      update()
    }
  }, [alphSigner, ethProvider, syncInfo, txTargetChain])

  useEffect(() => {
    if (alphSigner && ethProvider) {
      const update = async () => {
        const dbExist = await TransactionDB.exists()
        if (!dbExist || resync) {
          setIsLoading(true)
          await syncFromExplorer(
            alphSigner.nodeProvider,
            alphSigner.account.address,
            txTargetChain,
            isTransferCompleted,
            pageNumber
          ).then(syncInfo => {
            setIsLoading(false)
            setResync(false)
            setSyncInfo(syncInfo)
          }).catch(error => {
            setIsLoading(false)
            setResync(false)
            setLoadingError(error)
          })
        }
      }
      update()
    }
  }, [
    alphSigner,
    ethProvider,
    pageNumber,
    txTargetChain,
    isTransferCompleted,
    resync
  ])

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
        {
          (sourceChainReady && targetChainReady) ? (
            isLoading ? (
              <CircularProgress
                size={24}
                color="inherit"
                className={classes.loader}
              />
            ) : loadingError ? (
              <Alert severity="error" className={classes.error}>
                Loading transactions error: {loadingError}
              </Alert>
            ) : (
              <>
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
                <ListTransaction
                  status="Completed"
                  sourceChainId={txSourceChain}
                  targetChainId={txTargetChain}
                />
                {
                  (typeof syncInfo !== 'undefined' && syncInfo.syncing)
                    ? <>
                        <ButtonWithLoader
                          onClick={() => loadMoreTxsCallback()}
                          error={loadingError}
                          showLoader={isLoading}
                        >
                          Load More
                        </ButtonWithLoader>
                        <Typography variant="body2" align="center" className={classes.info}>
                          Load {syncInfo.loadedTxNum} transactions, {syncInfo.bridgeTxs.length} bridge transfer transactions.
                        </Typography>
                      </>
                    : <>
                      <ButtonWithLoader
                          onClick={() => resyncCallback()}
                          error={loadingError}
                          showLoader={isLoading}
                        >
                          Resync
                        </ButtonWithLoader>
                      </>
                }
              </>
            )
          ) : null
        }
      </Card>
    </Container>
  );
}
