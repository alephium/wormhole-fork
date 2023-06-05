import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  coalesceChainName,
  getIsTransferCompletedAlph,
  getIsTransferCompletedEth,
  getEmitterAddressEth,
  getTokenBridgeForChainId,
  isEVMChain,
  CHAIN_ID_ETH
} from "alephium-wormhole-sdk";
import { Card, Container, makeStyles } from "@material-ui/core";
import { useCallback, useEffect, useState } from "react";
import { COLORS } from "../../muiTheme";
import {
  EXPLORER_API_SERVER_HOST,
  CHAINS,
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  getTokenBridgeAddressForChain,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALEPHIUM_POLLING_INTERVAL
} from "../../utils/consts";
import ChainSelect from "../ChainSelect";
import KeyAndBalance from "../KeyAndBalance";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import { Alert } from "@material-ui/lab";
import { AlephiumWallet, useAlephiumWallet } from "../../hooks/useAlephiumWallet";
import { ethers } from "ethers";
import useSWR from "swr";
import { useSnackbar } from "notistack";
import { PageSwitch, DefaultPageSize } from "./PageSwitch";
import { getSignedVAAWithRetry } from "../../utils/getSignedVAAWithRetry";
import { getEVMCurrentBlockNumber, getEvmJsonRpcProvider, isEVMTxConfirmed } from "../../utils/ethereum";
import { TransactionTable } from "./TransactionTable";
import { binToHex } from "@alephium/web3";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import { useSelector } from "react-redux";
import { selectTransferSourceChain, selectTransferTargetChain } from "../../store/selectors";

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

async function getSignedVaa(tx: BridgeTransaction) {
  if (tx.vaa) return Buffer.from(tx.vaa, 'hex')

  const tokenBridgeAddress = getTokenBridgeAddressForChain(tx.emitterChain)
  const emitterAddress = isEVMChain(tx.emitterChain) ? getEmitterAddressEth(tokenBridgeAddress) : tokenBridgeAddress
  const signedVaa = tx.vaa
      ? Buffer.from(tx.vaa, 'hex')
      : (await getSignedVAAWithRetry(tx.emitterChain, emitterAddress, tx.targetChain, tx.sequence.toString())).vaaBytes
  tx.vaa = binToHex(signedVaa)
  return signedVaa
}

type BlockNumberFetcher = () => Promise<number | undefined>

const alphBlockNumberFetcher = (alphWallet?: AlephiumWallet) => {
  return alphWallet === undefined
    ? Promise.resolve(undefined)
    : alphWallet.nodeProvider.blockflow
      .getBlockflowChainInfo({
        fromGroup: alphWallet.group,
        toGroup: alphWallet.group
      })
      .then((chainInfo) => chainInfo.currentHeight)
}

const evmBlockNumberFetcher = (chainId: ChainId, provider?: ethers.providers.Provider) => {
  return provider === undefined
    ? Promise.resolve(undefined)
    : getEVMCurrentBlockNumber(provider, chainId)
}

function useBlockNumber(fetcherGetter: (chainId: ChainId) => (BlockNumberFetcher | undefined), chainId: ChainId): number | undefined {
  const { enqueueSnackbar } = useSnackbar()
  const chainName = coalesceChainName(chainId)
  const pollingInterval = chainId === CHAIN_ID_ALEPHIUM ? ALEPHIUM_POLLING_INTERVAL : 3000
  const fetcher = fetcherGetter(chainId)
  const { data: blockNumber, error } = useSWR(
    `${chainName}-block-number`,
    () => fetcher === undefined ? undefined : fetcher(),
    { refreshInterval: pollingInterval }
  )
  useEffect(() => {
    if (error) {
      enqueueSnackbar(null, {
        content: <Alert severity="error">{`Failed to get ${chainName} block number, error: ${error}`}</Alert>,
        preventDuplicate: true
      })
    }
  }, [error, enqueueSnackbar, chainName])
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
  sourceChainBlockNumber,
  targetChainBlockNumber,
  txs,
  isLoading,
  isTransferCompleted
}: {
  txSourceChain: ChainId,
  sourceChainBlockNumber: number | undefined,
  targetChainBlockNumber: number | undefined,
  txs: BridgeTransaction[],
  isLoading: boolean,
  isTransferCompleted: (signedVaa: Uint8Array) => Promise<boolean>
}) {
  const getTxStatus = useCallback(async (tx: BridgeTransaction) => {
    try {
      let txStatus = tx.status
      if ((tx.status === 'Pending' || tx.status === 'Loading') && sourceChainBlockNumber !== undefined) {
        txStatus = isTxConfirmed(sourceChainBlockNumber, tx.blockNumber, txSourceChain)
          ? 'Confirmed'
          : 'Pending'
      }
      if (txStatus === 'Confirmed' && targetChainBlockNumber !== undefined) {
        const signedVaa = await getSignedVaa(tx)
        const isCompleted = await isTransferCompleted(signedVaa)
        txStatus = isCompleted ? 'Completed' : txStatus
      }
      return txStatus
    } catch (error) {
      console.error(`failed to get tx status, tx: ${JSON.stringify(tx)}, error: ${error}`)
      return tx.status
    }
  }, [sourceChainBlockNumber, targetChainBlockNumber,  txSourceChain, isTransferCompleted])

  useEffect(() => {
    const fetch = async () => {
      try {
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i]
          const txStatus = await getTxStatus(tx)
          tx.status = txStatus
        }
      } catch (error) {
        console.error(`failed to get tx status, error: ${error}`)
      }
    }

    fetch()
  }, [txs, getTxStatus])

  return <TransactionTable txs={txs} isLoading={isLoading} />
}

export default function Transactions() {
  const classes = useStyles()
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTargetChain = useSelector(selectTransferTargetChain)
  const [txSourceChain, setTxSourceChain] =
    useState<ChainId>(transferSourceChain || CHAIN_ID_ALEPHIUM)
  const [txTargetChain, setTxTargetChain] =
    useState<ChainId>(transferTargetChain || CHAIN_ID_ETH)

  const { enqueueSnackbar } = useSnackbar()
  const alphWallet = useAlephiumWallet()
  const { provider: evmProvider, signerAddress: ethSignerAddress } = useEthereumProvider()
  const { isReady: sourceChainReady } = useIsWalletReady(txSourceChain, false)
  const { isReady: targetChainReady } = useIsWalletReady(txTargetChain, false)

  const walletAddress = isEVMChain(txSourceChain)
    ? ethSignerAddress
    : txSourceChain === CHAIN_ID_ALEPHIUM
    ? alphWallet?.address
    : undefined

  const [currentTransactions, setCurrentTransactions] = useState<BridgeTransaction[]>([])
  const [txNumber, setTxNumber] = useState<number>()
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  const bothAreEvmChain = isEVMChain(txSourceChain) && isEVMChain(txTargetChain)

  const blockNumberFetcherGetter = useCallback((chainId: ChainId) => {
    if (chainId === CHAIN_ID_ALEPHIUM) {
      return () => alphBlockNumberFetcher(alphWallet)
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

  const isTransferCompleted = useCallback(async (signedVaa: Uint8Array) => {
    if (txTargetChain === CHAIN_ID_ALEPHIUM && alphWallet) {
      const tokenBridgeForChainId = getTokenBridgeForChainId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, txSourceChain, alphWallet.group)
      return await getIsTransferCompletedAlph(tokenBridgeForChainId, alphWallet.group, signedVaa)
    }
    const provider = bothAreEvmChain ? getEvmJsonRpcProvider(txTargetChain) : targetChainReady ? evmProvider : undefined
    if (isEVMChain(txTargetChain) && provider) {
      const tokenBridgeAddress = getTokenBridgeAddressForChain(txTargetChain)
      return await getIsTransferCompletedEth(tokenBridgeAddress, provider, signedVaa)
    }
    enqueueSnackbar(null, {
      content: <Alert severity="error">{`Wallet is not connected`}</Alert>,
      preventDuplicate: true
    })
    return false
  }, [txTargetChain, txSourceChain, alphWallet, enqueueSnackbar, evmProvider, targetChainReady, bothAreEvmChain])

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
          content: <Alert severity="error">{`Failed to get tx number, error: ${error}`}</Alert>,
        });
        console.error(`failed to get tx number, error: ${error}`)
      }
    }

    fetch()
  }, [walletAddress, txSourceChain, txTargetChain, enqueueSnackbar])

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
          content: <Alert severity="error">{`Failed to get txs, error: ${error}`}</Alert>,
        });
        console.error(`failed to get txs, error: ${error}`)
      }
    }

    fetch()

  }, [walletAddress, txSourceChain, txTargetChain, pageNumber, enqueueSnackbar])

  const ready = bothAreEvmChain ? sourceChainReady : (sourceChainReady && targetChainReady)

  return (
    <Container maxWidth="md">
      <Card className={classes.mainCard}>
        <ChainSelect
          select
          variant="outlined"
          label="Source Chain"
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
          label="Target Chain"
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
                    sourceChainBlockNumber={sourceChainBlockNumber}
                    targetChainBlockNumber={targetChainBlockNumber}
                    txs={currentTransactions}
                    isLoading={isLoading}
                    isTransferCompleted={isTransferCompleted}
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
