import { useSelector } from 'react-redux'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import ChainSelectors from '../ChainSelectors'
import { selectTransferSourceChain, selectTransferTargetChain } from '../../../store/selectors'
import {
  evmBlockNumberFetcher,
  alphBlockNumberFetcher,
  ListTransactions,
  useBlockNumber,
  BridgeTransaction,
  getTxsByPageNumber,
  getTxNumber
} from '../../Transactions'
import { DefaultPageSize, PageSwitch } from '../../Transactions/PageSwitch'
import { useCallback, useEffect, useState } from 'react'
import { CHAIN_ID_ALEPHIUM, ChainId, getTokenBridgeForChainId, isEVMChain } from '@alephium/wormhole-sdk'
import { ALEPHIUM_BRIDGE_GROUP_INDEX, ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID } from '../../../utils/consts'
import { useWallet } from '@alephium/web3-react'
import { useEthereumProvider } from '../../../contexts/EthereumProviderContext'
import { useSnackbar } from 'notistack'
import { Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { getIsTxsCompletedEvm } from '../../../utils/evm'
import { getIsTxsCompletedAlph } from '../../../utils/alephium'
import { useWidgetStyles } from '../styles'

const TransactionsHistoryPage = () => {
  const { classes: widgetClasses } = useWidgetStyles()
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTargetChain = useSelector(selectTransferTargetChain)
  const { isReady: sourceChainReady } = useIsWalletReady(transferSourceChain, false)
  const { isReady: targetChainReady } = useIsWalletReady(transferTargetChain, false)
  const alphWallet = useWallet()
  const { provider: evmProvider, signerAddress: ethSignerAddress } = useEthereumProvider()
  const { enqueueSnackbar } = useSnackbar()
  const { t } = useTranslation()

  const [currentTransactions, setCurrentTransactions] = useState<BridgeTransaction[]>([])
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  const [txNumber, setTxNumber] = useState<number>()

  const walletAddress = isEVMChain(transferSourceChain)
    ? ethSignerAddress
    : transferSourceChain === CHAIN_ID_ALEPHIUM
    ? alphWallet?.account?.address
    : undefined

  const ready = sourceChainReady && targetChainReady

  const blockNumberFetcherGetter = useCallback(
    (chainId: ChainId) => {
      if (chainId === CHAIN_ID_ALEPHIUM) {
        return alphWallet.connectionStatus !== 'connected'
          ? undefined
          : () => alphBlockNumberFetcher(alphWallet.nodeProvider, ALEPHIUM_BRIDGE_GROUP_INDEX)
      }
      if (isEVMChain(chainId)) {
        return () => evmBlockNumberFetcher(chainId, evmProvider)
      }
      return undefined
    },
    [alphWallet.connectionStatus, alphWallet.nodeProvider, evmProvider]
  )

  const sourceChainBlockNumber = useBlockNumber(blockNumberFetcherGetter, transferSourceChain)
  const targetChainBlockNumber = useBlockNumber(blockNumberFetcherGetter, transferTargetChain)

  const getIsTxsCompleted = useCallback(
    async (txs: BridgeTransaction[]) => {
      if (transferTargetChain === CHAIN_ID_ALEPHIUM && alphWallet.connectionStatus === 'connected') {
        const tokenBridgeForChainId = getTokenBridgeForChainId(
          ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
          transferSourceChain,
          ALEPHIUM_BRIDGE_GROUP_INDEX
        )
        return await getIsTxsCompletedAlph(
          tokenBridgeForChainId,
          txs.map((t) => BigInt(t.sequence))
        )
      }
      if (isEVMChain(transferTargetChain) && targetChainReady && evmProvider) {
        return await getIsTxsCompletedEvm(
          transferTargetChain,
          evmProvider,
          txs.map((t) => t.vaa)
        )
      }
      enqueueSnackbar(null, {
        content: <Alert severity="error">{t('Wallet is not connected')}</Alert>,
        preventDuplicate: true
      })
      return txs.map((_) => false)
    },
    [
      alphWallet.connectionStatus,
      enqueueSnackbar,
      evmProvider,
      t,
      targetChainReady,
      transferSourceChain,
      transferTargetChain
    ]
  )

  useEffect(() => {
    if (!walletAddress || !pageNumber) return

    const fetch = async () => {
      setIsLoading(true)
      try {
        const txs = await getTxsByPageNumber(walletAddress, transferSourceChain, transferTargetChain, pageNumber)
        setCurrentTransactions(txs)
        setIsLoading(false)
      } catch (error) {
        setIsLoading(false)
        enqueueSnackbar(null, {
          content: <Alert severity="error">{`${t('Failed to get txs')}, ${t('Error')}: ${error}`}</Alert>
        })
        console.error(`failed to get txs, error: ${error}`)
      }
    }

    fetch()
  }, [enqueueSnackbar, pageNumber, t, transferSourceChain, transferTargetChain, walletAddress])

  useEffect(() => {
    if (!walletAddress) return

    const fetch = async () => {
      try {
        const txNumber = await getTxNumber(walletAddress, transferSourceChain, transferTargetChain)
        setTxNumber(txNumber)
      } catch (error) {
        enqueueSnackbar(null, {
          content: <Alert severity="error">{`${t('Failed to get tx number')}, ${t('Error')}: ${error}`}</Alert>
        })
        console.error(`failed to get tx number, error: ${error}`)
      }
    }

    fetch()
  }, [enqueueSnackbar, t, transferSourceChain, transferTargetChain, walletAddress])

  return (
    <>
      <ChainSelectors />

      <div className={widgetClasses.grayRoundedBox}>
        {ready ? (
          <div>
            <ListTransactions
              txSourceChain={transferSourceChain}
              txTargetChain={transferTargetChain}
              sourceChainBlockNumber={sourceChainBlockNumber}
              targetChainBlockNumber={targetChainBlockNumber}
              txs={currentTransactions}
              isLoading={isLoading}
              getIsTxsCompleted={getIsTxsCompleted}
              tableLayout="compact"
            />
            <PageSwitch
              pageNumber={pageNumber}
              setPageNumber={setPageNumber}
              totalNumberOfPages={txNumber ? Math.ceil(txNumber / DefaultPageSize) : 0}
              numberOfElementsLoaded={currentTransactions?.length}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}

export default TransactionsHistoryPage
