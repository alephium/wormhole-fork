import AlephiumBridgeWidget from '../AlephiumBridgeWidget'
import BridgeWidgetButton from '../components/BridgeWidget/BridgeWidgetButton'
import Divider from '../components/BridgeWidget/Divider'
import SuccessPulse from '../components/BridgeWidget/SuccessPulse'
import TransactionTableCompact from '../components/BridgeWidget/TransactionTableCompact'
import { setCluster } from '../utils/consts'
import { WalletProviders } from '../contexts/WalletProviders'

export default AlephiumBridgeWidget

export { setCluster, BridgeWidgetButton, Divider, SuccessPulse, TransactionTableCompact, WalletProviders }

export * from '../contexts/EthereumProviderContext'
export * from '../contexts/SolanaWalletContext'
export * from '../contexts/AlgorandWalletContext'
