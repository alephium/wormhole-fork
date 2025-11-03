import {
  CircularProgress,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme
} from '@material-ui/core'
import { useTranslation } from 'react-i18next'
import { BridgeTransaction, TxStatus } from '../Transactions'
import SmartAddress from './SmartAddress'

const useStyles = makeStyles(() => ({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  }
}))

interface Column {
  id: 'txId' | 'blockNumber' | 'status'
  label: string
  compactLabel: string
  align?: 'right'
  format?: (tx: BridgeTransaction, isCompact?: boolean) => any
}

const columns: Column[] = [
  {
    id: 'txId',
    label: 'Transaction\u00a0ID',
    compactLabel: 'TX ID',
    format: (tx: BridgeTransaction, isCompact?: boolean) => (
      <SmartAddress transactionAddress={tx.txId} chainId={tx.emitterChain} isCompact={isCompact} />
    )
  },
  {
    id: 'blockNumber',
    label: 'Block\u00a0Number',
    compactLabel: 'Block',
    align: 'right',
    format: (tx: BridgeTransaction) => tx.blockNumber.toLocaleString('en-US')
  },
  {
    id: 'status',
    label: 'Status',
    compactLabel: 'Status',
    align: 'right',
    format: (tx: BridgeTransaction) => {
      return tx.status === 'Loading' ? <CircularProgress size={20} color="inherit" /> : tx.status
    }
  }
]

const TransactionTableCompact = (params: { txs: BridgeTransaction[]; txsStatus: TxStatus[]; isLoading: boolean }) => {
  const { t } = useTranslation()
  const classes = useStyles()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <TableContainer className={classes.container}>
      {params.isLoading ? (
        <CircularProgress size={24} color="inherit" />
      ) : params.txs.length > 0 ? (
        <Table stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align} style={{ backgroundColor: 'transparent' }}>
                  {isMobile ? column.compactLabel : column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody style={{ fontSize: isMobile ? '12px' : '14px' }}>
            {params.txs.map((tx, index) => {
              return (
                <TableRow hover role="checkbox" tabIndex={-1} key={tx.txId}>
                  {columns.map((column) => {
                    const txWithStatus = { ...tx, status: params.txsStatus[index] }
                    return (
                      <TableCell key={column.id} align={column.align} style={{ fontSize: isMobile ? '12px' : '14px' }}>
                        {column.format ? column.format(txWithStatus, isMobile) : txWithStatus[column.id]}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <Typography variant="body1">{t('No transactions yet')}</Typography>
      )}
    </TableContainer>
  )
}

export default TransactionTableCompact
