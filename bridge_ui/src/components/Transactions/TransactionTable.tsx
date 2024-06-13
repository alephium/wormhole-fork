import {
  CircularProgress,
  makeStyles,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@material-ui/core";
import { useTranslation } from "react-i18next";
import { BridgeTransaction, TxStatus } from ".";
import SmartTx from "./SmartTx";

const useStyles = makeStyles(() => ({
  container: {
    maxHeight: 800,
    marginTop: '25px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
}));

interface Column {
  id: "txId" | "blockNumber" | "status"
  label: string
  minWidth?: number
  align?: "right"
  format?: (tx: BridgeTransaction) => any
}

const columns: Column[] = [
  {
    id: "txId",
    label: "Transaction\u00a0Id",
    minWidth: 170,
    format: (tx: BridgeTransaction) => <SmartTx tx={tx}/>
  },
  {
    id: "blockNumber",
    label: "Block\u00a0Number",
    minWidth: 100,
    align: "right",
    format: (tx: BridgeTransaction) => <span style={{fontSize: '14px'}}>{tx.blockNumber.toLocaleString("en-US")}</span>
  },
  {
    id: "status",
    label: "Status",
    minWidth: 170,
    align: "right",
    format: (tx: BridgeTransaction) => {
      return tx.status === 'Loading'
        ? <CircularProgress
            size={20}
            color="inherit"
          />
        : <span style={{fontSize: '14px'}}>{tx.status}</span>
    }
  }
];

export function TransactionTable(params: { txs: BridgeTransaction[], txsStatus: TxStatus[], isLoading: boolean }) {
  const { t } = useTranslation()
  const classes = useStyles()

  return (
    <TableContainer className={classes.container}>
      {params.isLoading
        ? <CircularProgress
            size={24}
            color="inherit"
          />
        : params.txs.length > 0
        ? <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {params.txs.map((tx, index) => {
                return (
                  <TableRow hover role="checkbox" tabIndex={-1} key={tx.txId}>
                    {columns.map((column) => {
                      const txWithStatus = { ...tx, status: params.txsStatus[index] }
                      return (
                        <TableCell key={column.id} align={column.align}>
                          {column.format ? column.format(txWithStatus) : txWithStatus[column.id]}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        : <Typography variant="body1">{t("No transactions yet")}</Typography>
      }
    </TableContainer>
  )
}
