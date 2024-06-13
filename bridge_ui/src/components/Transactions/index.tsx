import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  coalesceChainName,
  getTokenBridgeForChainId,
  isEVMChain,
  CHAIN_ID_ETH
} from "@alephium/wormhole-sdk";
import { Card, Container, makeStyles } from "@material-ui/core";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../../muiTheme";
import {
  EXPLORER_API_SERVER_HOST,
  CHAINS,
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALEPHIUM_POLLING_INTERVAL
} from "../../utils/consts";
import ChainSelect from "../ChainSelect";
import KeyAndBalance from "../KeyAndBalance";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import { Alert } from "@material-ui/lab";
import { ethers } from "ethers";
import useSWR from "swr";
import { useSnackbar } from "notistack";
import { PageSwitch, DefaultPageSize } from "./PageSwitch";
import { getEVMCurrentBlockNumber, getEvmJsonRpcProvider, getIsTxsCompletedEvm, isEVMTxConfirmed } from "../../utils/ethereum";
import { TransactionTable } from "./TransactionTable";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import { useSelector } from "react-redux";
import { selectTransferSourceChain, selectTransferTargetChain } from "../../store/selectors";
import { getIsTxsCompletedAlph } from "../../utils/alephium";
import { useWallet } from "@alephium/web3-react";
import { NodeProvider } from "@alephium/web3";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles(() => ({
  mainCard: {
    padding: "32px 32px 16px",
    backgroundColor: COLORS.whiteWithTransparency,
  },
}));

async function getTxNumber(address: string, emitterChain: ChainId, targetChain: ChainId): Promise<number> {
  const url = `${EXPLORER_API_SERVER_HOST}/api/transactions/${address}/${emitterChain}/${targetChain}/count`
  const response = await fetch(url)
  const json = await response.json()
  return json.txNumber as number
}

export type TxStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Loading'

export type BridgeTransaction = {
  id: string
  txId: string
  address: string
  blockHash: string
  blockNumber: number
  sequence: number
  emitterChain: ChainId
  targetChain: ChainId
  vaa: string
  status: TxStatus
}

async function getTxsByPageNumber(address: string, emitterChain: ChainId, targetChain: ChainId, pageNumber: number): Promise<BridgeTransaction[]> {
  const url = `${EXPLORER_API_SERVER_HOST}/api/transactions/${address}/${emitterChain}/${targetChain}?page=${pageNumber}&pageSize=${DefaultPageSize}`
  const response = await fetch(url)
  const json = await response.json()
  return (json as BridgeTransaction[]).map((tx) => ({ ...tx, status: 'Loading'}))
}

type BlockNumberFetcher = () => Promise<number | undefined>

const alphBlockNumberFetcher = (nodeProvider: NodeProvider | undefined, group: number) => {
  return nodeProvider === undefined
    ? Promise.resolve(undefined)
    : nodeProvider.blockflow
      .getBlockflowChainInfo({ fromGroup: group, toGroup: group })
      .then((chainInfo) => chainInfo.currentHeight)
}

const evmBlockNumberFetcher = (chainId: ChainId, provider?: ethers.providers.Provider) => {
  return provider === undefined
    ? Promise.resolve(undefined)
    : getEVMCurrentBlockNumber(provider, chainId)
}

function useBlockNumber(fetcherGetter: (chainId: ChainId) => (BlockNumberFetcher | undefined), chainId: ChainId): number | undefined {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  const chainName = coalesceChainName(chainId)
  const pollingInterval = chainId === CHAIN_ID_ALEPHIUM ? ALEPHIUM_POLLING_INTERVAL : 3000
  const fetcher = fetcherGetter(chainId)
  const { data: blockNumber, error } = useSWR(
    fetcher === undefined ? null : `${chainName}-block-number`,
    () => fetcher === undefined ? undefined : fetcher(),
    { refreshInterval: pollingInterval }
  )
  useEffect(() => {
    if (error) {
      enqueueSnackbar(null, {
        content: <Alert severity="error">{`${t('Failed to get {{ chainName }} block number', { chainName })}, ${t('Error')}: ${error}`}</Alert>,
        preventDuplicate: true
      })
    }
  }, [error, enqueueSnackbar, chainName, t])
  return blockNumber
}

function isTxConfirmed(currentBlockNumber: number, txBlockNumber: number, chainId: ChainId): boolean {
  if (chainId === CHAIN_ID_ALEPHIUM) {
    return txBlockNumber + ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL <= currentBlockNumber
  }
  if (isEVMChain(chainId)) {
    return isEVMTxConfirmed(chainId, txBlockNumber, currentBlockNumber)
  }
  return false
}

function ListTransactions({
  txSourceChain,
  txTargetChain,
  sourceChainBlockNumber,
  targetChainBlockNumber,
  txs,
  isLoading,
  getIsTxsCompleted,
}: {
  txSourceChain: ChainId,
  txTargetChain: ChainId,
  sourceChainBlockNumber: number | undefined,
  targetChainBlockNumber: number | undefined,
  txs: BridgeTransaction[],
  isLoading: boolean,
  getIsTxsCompleted: (txs: BridgeTransaction[]) => Promise<boolean[]>
}) {
  const [txsStatus, setTxsStatus] = useState<TxStatus[]>(txs.map((tx) => tx.status))
  const [hasNewConfirmedTx, setHasNewConfirmedTx] = useState<boolean>(false)

  useEffect(() => {
    if (sourceChainBlockNumber === undefined) {
      return
    }

    const pendingAndLoadingTxs = txs.filter((tx) => tx.status === 'Pending' || tx.status === 'Loading')
    const confirmedTxsSize0 = txs.filter((tx) => tx.status === 'Confirmed').length
    pendingAndLoadingTxs.forEach((tx) => {
      tx.status = isTxConfirmed(sourceChainBlockNumber, tx.blockNumber, txSourceChain) ? 'Confirmed' : 'Pending'
    })
    const confirmedTxsSize1 = txs.filter((tx) => tx.status === 'Confirmed').length
    setHasNewConfirmedTx(confirmedTxsSize1 > confirmedTxsSize0)
    setTxsStatus(txs.map((tx) => tx.status))

  }, [txs, txSourceChain, sourceChainBlockNumber])

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      if (targetChainBlockNumber === undefined && !hasNewConfirmedTx) {
        return
      }

      const confirmedTxs = txs.filter((tx) => tx.vaa && tx.status === 'Confirmed')
      if (confirmedTxs.length === 0) {
        return
      }
      try {
        const results = await getIsTxsCompleted(confirmedTxs)
        confirmedTxs.forEach(((tx, index) => {
          if (results[index]) tx.status = 'Completed'
        }))
      } catch (error) {
        console.error(`${error}`)
      }
    }

    fetch().then(() => {
      if (!cancelled) setTxsStatus(txs.map((tx) => tx.status))
    })
  }, [txs, txSourceChain, txTargetChain, targetChainBlockNumber, getIsTxsCompleted, hasNewConfirmedTx])

  return <TransactionTable txs={txs} txsStatus={txsStatus} isLoading={isLoading}/>
}

export default function Transactions() {
  const { t } = useTranslation()
  const classes = useStyles()
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTargetChain = useSelector(selectTransferTargetChain)
  const [txSourceChain, setTxSourceChain] =
    useState<ChainId>(transferSourceChain || CHAIN_ID_ALEPHIUM)
  const [txTargetChain, setTxTargetChain] =
    useState<ChainId>(transferTargetChain || CHAIN_ID_ETH)

  const { enqueueSnackbar } = useSnackbar()
  const alphWallet = useWallet()
  const { provider: evmProvider, signerAddress: ethSignerAddress } = useEthereumProvider()
  const { isReady: sourceChainReady } = useIsWalletReady(txSourceChain, false)
  const { isReady: targetChainReady } = useIsWalletReady(txTargetChain, false)

  const walletAddress = isEVMChain(txSourceChain)
    ? ethSignerAddress
    : txSourceChain === CHAIN_ID_ALEPHIUM
    ? alphWallet?.account?.address
    : undefined

  const [currentTransactions, setCurrentTransactions] = useState<BridgeTransaction[]>([])
  const [txNumber, setTxNumber] = useState<number>()
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  const bothAreEvmChain = isEVMChain(txSourceChain) && isEVMChain(txTargetChain)

  const blockNumberFetcherGetter = useCallback((chainId: ChainId) => {
    if (chainId === CHAIN_ID_ALEPHIUM) {
      return alphWallet.connectionStatus !== 'connected'
        ? undefined
        : () => alphBlockNumberFetcher(alphWallet.nodeProvider, alphWallet.account.group)
    }
    if (bothAreEvmChain) {
      if (chainId === txSourceChain && sourceChainReady) {
        return () => evmBlockNumberFetcher(chainId, evmProvider)
      }
      if (chainId === txTargetChain) {
        return () => evmBlockNumberFetcher(chainId, getEvmJsonRpcProvider(chainId))
      }
    }
    if (isEVMChain(chainId)) {
      return () => evmBlockNumberFetcher(chainId, evmProvider)
    }
    return undefined
  }, [alphWallet, evmProvider, bothAreEvmChain, txSourceChain, txTargetChain, sourceChainReady])

  const sourceChainBlockNumber = useBlockNumber(blockNumberFetcherGetter, txSourceChain)
  const targetChainBlockNumber = useBlockNumber(blockNumberFetcherGetter, txTargetChain)

  const getIsTxsCompleted = useCallback(async (txs: BridgeTransaction[]) => {
    if (txTargetChain === CHAIN_ID_ALEPHIUM && alphWallet.connectionStatus === 'connected') {
      const tokenBridgeForChainId = getTokenBridgeForChainId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, txSourceChain, alphWallet.account.group)
      return await getIsTxsCompletedAlph(tokenBridgeForChainId, txs.map((t) => BigInt(t.sequence)))
    }
    const provider = bothAreEvmChain ? getEvmJsonRpcProvider(txTargetChain) : targetChainReady ? evmProvider : undefined
    if (isEVMChain(txTargetChain) && provider) {
      return await getIsTxsCompletedEvm(txTargetChain, provider, txs.map((t) => t.vaa))
    }
    enqueueSnackbar(null, {
      content: <Alert severity="error">{t('Wallet is not connected')}</Alert>,
      preventDuplicate: true
    })
    return txs.map((_) => false)
  }, [txTargetChain, txSourceChain, alphWallet, enqueueSnackbar, evmProvider, targetChainReady, bothAreEvmChain, t])

  const reset = () => {
    setTxNumber(undefined)
    setPageNumber(1)
    setCurrentTransactions([])
    setIsLoading(true)
  }

  const handleSourceChainChange = useCallback((event: any) => {
    const newSourceChain = event.target.value
    setTxSourceChain((prevSourceChain) => {
      setTxTargetChain((prevTargetChain) => {
        return newSourceChain === prevTargetChain ? prevSourceChain : prevTargetChain
      })
      return newSourceChain
    })
    reset()
  }, [])

  const handleTargetChainChange = useCallback((event: any) => {
    setTxTargetChain(event.target.value)
    reset()
  }, [])

  useEffect(() => {
    if (!walletAddress) return

    const fetch = async () => {
      try {
        const txNumber = await getTxNumber(walletAddress, txSourceChain, txTargetChain)
        setTxNumber(txNumber)
      } catch (error) {
        enqueueSnackbar(null, {
          content: <Alert severity="error">{`${t('Failed to get tx number')}, ${t('Error')}: ${error}`}</Alert>,
        });
        console.error(`failed to get tx number, error: ${error}`)
      }
    }

    fetch()
  }, [walletAddress, txSourceChain, txTargetChain, enqueueSnackbar, t])

  useEffect(() => {
    if (!walletAddress || !pageNumber) return

    const fetch = async () => {
      setIsLoading(true)
      try {
        const txs = await getTxsByPageNumber(walletAddress, txSourceChain, txTargetChain, pageNumber)
        setCurrentTransactions(txs)
        setIsLoading(false)
      } catch (error) {
        setIsLoading(false)
        enqueueSnackbar(null, {
          content: <Alert severity="error">{`${t('Failed to get txs')}, ${t('Error')}: ${error}`}</Alert>,
        });
        console.error(`failed to get txs, error: ${error}`)
      }
    }

    fetch()

  }, [walletAddress, txSourceChain, txTargetChain, pageNumber, enqueueSnackbar, t])

  const ready = bothAreEvmChain ? sourceChainReady : (sourceChainReady && targetChainReady)

  return (
    <Container maxWidth="md">
      <Card className={classes.mainCard}>
        <ChainSelect
          select
          variant="outlined"
          label={t("Source Chain")}
          value={txSourceChain}
          onChange={handleSourceChainChange}
          fullWidth
          margin="normal"
          chains={CHAINS}
        />
        <KeyAndBalance chainId={txSourceChain} />
        <ChainSelect
          select
          variant="outlined"
          label={t("Target Chain")}
          value={txTargetChain}
          onChange={handleTargetChainChange}
          fullWidth
          margin="normal"
          chains={CHAINS.filter((c) => c.id !== txSourceChain)}
        />
        {bothAreEvmChain ? null : <KeyAndBalance chainId={txTargetChain} />}
        {
          <>
            {ready
              ? <div>
                  <ListTransactions
                    txSourceChain={txSourceChain}
                    txTargetChain={txTargetChain}
                    sourceChainBlockNumber={sourceChainBlockNumber}
                    targetChainBlockNumber={targetChainBlockNumber}
                    txs={currentTransactions}
                    isLoading={isLoading}
                    getIsTxsCompleted={getIsTxsCompleted}
                  />
                  <PageSwitch
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                    totalNumberOfPages={txNumber ? Math.ceil(txNumber / DefaultPageSize) : 0}
                    numberOfElementsLoaded={currentTransactions?.length}
                  />
                </div>
              : null
            }
          </>
        }
      </Card>
    </Container>
  );
}
