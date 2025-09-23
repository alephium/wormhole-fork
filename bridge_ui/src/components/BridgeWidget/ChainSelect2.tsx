import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  makeStyles,
  MenuItem,
  OutlinedTextFieldProps,
  Popover,
  TextField,
  Typography,
} from '@material-ui/core'
import { AccountBalanceWalletOutlined } from "@material-ui/icons";
import clsx from 'clsx'
import { ReactNode, useMemo, useState } from 'react'
import { useBetaContext } from '../../contexts/BetaContext'
import { BETA_CHAINS, ChainInfo } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, ChainName, isEVMChain, toChainName } from '@alephium/wormhole-sdk'
import { AlephiumConnectButton } from '@alephium/web3-react'
import { useEthereumProvider } from '../../contexts/EthereumProviderContext'
import useCopyToClipboard from '../../hooks/useCopyToClipboard'
import { GRAY, useWidgetStyles } from './styles'

const useStyles = makeStyles((theme) => ({
  select: {
    '& .MuiSelect-root': {
      display: 'flex',
      alignItems: 'center',
      padding: 0
    },

    '& fieldset': {
      border: 'none'
    },

    '& .MuiSelect-iconOutlined': {
      display: 'none'
    },

    '& .MuiSelect-selectMenu:focus': {
      backgroundColor: 'transparent'
    },

    '& label': {
      display: 'none'
    }
  },
  listItemIcon: {
    width: 40,
    height: 40,
    minWidth: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    marginRight: theme.spacing(2)
  },
  icon: {
    height: 24,
    width: 24
  },
  listItemTextContainer: {
    display: 'flex',
    flexDirection: 'column'
  },
  listItemValue: {
    margin: 0
  },
  accountAddress: {
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    '&:hover': {
      color: 'rgba(255, 255, 255, 0.7)'
    }
  },
  modalTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalContent: {
    minWidth: '200px'
  },
  chainSelectLabelButton: {
    position: 'absolute',
    right: theme.spacing(2),
    transform: 'translateY(-50%)',
    top: '50%',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: '5px 10px',
    borderRadius: 30,
    color: theme.palette.grey[300]
  }
}))

const chainColors: Partial<Record<ChainName, string>> = {
  alephium: '#000000',
  ethereum: '#4628df',
  bsc: '#deb440',
}

const createChainMenuItem = ({ id, name, logo }: ChainInfo, label: ReactNode, selected: boolean, classes: any) => {
  const backgroundColor = chainColors[toChainName(id)]

  return (
    <MenuItem key={id} value={id}>
      <ListItemIcon className={classes.listItemIcon} style={{ backgroundColor }}>
        <img src={logo} alt={name} className={classes.icon} />
      </ListItemIcon>
      <div className={classes.listItemTextContainer}>
        {selected && <Label>{label}</Label>}
        <ListItemText className={classes.listItemValue}>{name}</ListItemText>
      </div>
    </MenuItem>
  )
}

interface ChainSelectProps extends OutlinedTextFieldProps {
  chains: ChainInfo[]
}

export default function ChainSelect2({ chains, ...rest }: ChainSelectProps) {
  const classes = useStyles()
  const widgetClasses = useWidgetStyles()
  const isBeta = useBetaContext()
  const filteredChains = useMemo(
    () => chains.filter(({ id }) => (isBeta ? true : !BETA_CHAINS.includes(id))),
    [chains, isBeta]
  )
  return (
    <div className={widgetClasses.grayRoundedBox}>
      <TextField {...rest} className={clsx(classes.select, rest.className)}>
        {filteredChains.map((chain) => createChainMenuItem(chain, rest.label, rest.value === chain.id, classes))}
      </TextField>
      <div className={classes.chainSelectLabelButton}>
        <AccountBalanceWalletOutlined style={{ fontSize: '16px' }} color="inherit" />
        <ConnectedChainAccount chainId={rest.value as ChainId} />
      </div>
    </div>
  )
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <Typography style={{ fontSize: '12px', fontWeight: 600, color: GRAY }}>{children}</Typography>
)

const ConnectedChainAccount = ({ chainId }: { chainId: ChainId }) => {
  if (isEVMChain(chainId)) {
    return <CurrentlyConnectedEVMAccount />
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ isConnected, show, disconnect, account }) => {
          return (
            // `show` and `hide` will never be undefined. TODO: Fix the types in web3-react
            account?.address && <AccountAddress address={account.address} disconnect={disconnect} />
          )
        }}
      </AlephiumConnectButton.Custom>
    )
  }

  return null
}

const CurrentlyConnectedEVMAccount = () => {
  const { signerAddress, disconnect } = useEthereumProvider()
  return signerAddress ? <AccountAddress address={signerAddress} disconnect={disconnect} /> : null
}

const AccountAddress = ({ address, disconnect }: { address: string; disconnect: () => void }) => {
  const classes = useStyles()

  const [open, setOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const copyToClipboard = useCopyToClipboard(address)

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setAnchorEl(null)
  }

  const handleCopy = () => {
    copyToClipboard()
    handleClose()
  }

  return (
    <>
      <Typography className={classes.accountAddress} onClick={handleOpen}>
        {address.slice(0, 5) + '...' + address.slice(-5)}
      </Typography>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        classes={{ paper: classes.modalContent }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <List>
          <ListItem button onClick={handleCopy}>
            <ListItemText primary="Copy address" />
          </ListItem>
          <ListItem button onClick={disconnect}>
            <ListItemText primary="Disconnect" />
          </ListItem>
        </List>
      </Popover>
    </>
  )
}
