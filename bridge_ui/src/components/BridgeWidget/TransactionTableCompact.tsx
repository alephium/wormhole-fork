import {
  CircularProgress,
  IconButton,
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
import { isValidElement, ReactNode, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory, useLocation } from 'react-router'
import { setBridgeWidgetPage } from '../../store/transferSlice'
import clsx from 'clsx'
import { RestoreOutlined } from '@material-ui/icons'
import { Tooltip } from '@material-ui/core'

const useStyles = makeStyles(() => ({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  recoverButton: {
    padding: 4,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
}))

interface Column {
  id: 'txId' | 'status' | 'recover'
  label: string
  compactLabel: string
  align?: 'right'
  minWidth?: number
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
    id: 'status',
    label: 'Status',
    compactLabel: 'Status',
    align: 'right',
    format: (tx: BridgeTransaction) => {
      return tx.status === 'Loading' ? <CircularProgress size={20} color="inherit" /> : tx.status
    }
  },
  {
    id: 'recover',
    label: '',
    compactLabel: '',
    align: 'right',
    minWidth: 36,
    format: () => null
  }
]

const TransactionTableCompact = (params: {
  txs: BridgeTransaction[]
  txsStatus: TxStatus[]
  isLoading: boolean
}) => {
  const { t } = useTranslation()
  const classes = useStyles()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const dispatch = useDispatch()
  const history = useHistory()
  const location = useLocation()
  const columnMinWidths = useMemo(() => {
    return columns.reduce(
      (acc, column) => {
        acc[column.id] = column.minWidth
        return acc
      },
      {} as Record<Column['id'], number | undefined>
    )
  }, [])

  const handleRecoverClick = useCallback(
    (tx: BridgeTransaction) => {
      dispatch(setBridgeWidgetPage('recovery'))
      const searchParams = new URLSearchParams(location.search)
      searchParams.set('sourceChain', tx.emitterChain.toString())
      searchParams.set('transactionId', tx.txId)
      history.replace({ pathname: location.pathname, search: `?${searchParams.toString()}` })
    },
    [dispatch, history, location.pathname, location.search]
  )

  const renderCellContent = useCallback(
    (column: Column, txWithStatus: BridgeTransaction & { status: TxStatus }) => {
      if (column.id === 'status') {
        return column.format ? column.format(txWithStatus, isMobile) : txWithStatus.status
      }

      if (column.id === 'recover') {
        if (txWithStatus.status !== 'Confirmed') {
          return null
        }

        return (
          <Tooltip title={t('Recover')}>
            <IconButton
              className={clsx('MuiIconButton-sizeSmall', classes.recoverButton)}
              color="primary"
              size="small"
              onClick={() => handleRecoverClick(txWithStatus)}
              aria-label={t('Recover')}
            >
              <RestoreOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      }

      const baseContent = column.format ? column.format(txWithStatus, isMobile) : (txWithStatus[column.id] as ReactNode)
      const normalizedContent = isValidElement(baseContent) ? (
        baseContent
      ) : (
        <span style={{ fontSize: isMobile ? '12px' : '14px' }}>{baseContent}</span>
      )
      return normalizedContent
    },
    [classes.recoverButton, handleRecoverClick, isMobile, t]
  )

  const tableRows = useMemo(() => {
    return params.txs.map((tx, index) => {
      const txWithStatus = { ...tx, status: params.txsStatus[index] }
      const cells = columns.map((column) => ({
        id: column.id,
        align: column.align,
        content: renderCellContent(column, txWithStatus)
      }))

      return { key: tx.txId, cells }
    })
  }, [params.txs, params.txsStatus, renderCellContent])

  return (
    <TableContainer className={classes.container}>
      {params.isLoading ? (
        <CircularProgress size={24} color="inherit" />
      ) : params.txs.length > 0 ? (
        <Table stickyHeader aria-label="sticky table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ backgroundColor: 'transparent', width: column.minWidth, minWidth: column.minWidth }}
                >
                  {isMobile ? column.compactLabel : column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody style={{ fontSize: isMobile ? '12px' : '14px' }}>
            {tableRows.map((row) => {
              return (
                <TableRow hover role="checkbox" tabIndex={-1} key={row.key}>
                  {row.cells.map((cell) => (
                    <TableCell
                      key={cell.id}
                      align={cell.align}
                      style={{
                        fontSize: isMobile ? '12px' : '14px',
                        width: columnMinWidths[cell.id],
                        minWidth: columnMinWidths[cell.id],
                        paddingRight: cell.id === 'recover' ? 0 : undefined,
                        paddingLeft: cell.id === 'recover' ? 0 : undefined
                      }}
                    >
                      {cell.content}
                    </TableCell>
                  ))}
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
