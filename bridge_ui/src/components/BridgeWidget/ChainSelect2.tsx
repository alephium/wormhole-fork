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
import { AccountBalanceWalletOutlined } from '@material-ui/icons'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import clsx from 'clsx'
import { ReactNode, useMemo, useRef, useState } from 'react'
import { useBetaContext } from '../../contexts/BetaContext'
import { BETA_CHAINS, ChainInfo } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, ChainName, isEVMChain, toChainName } from '@alephium/wormhole-sdk'
import { AlephiumConnectButton } from '@alephium/web3-react'
import { useEthereumProvider } from '../../contexts/EthereumProviderContext'
import useCopyToClipboard from '../../hooks/useCopyToClipboard'
import { GRAY, GREEN, useWidgetStyles } from './styles'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import SuccessPulse from './SuccessPulse'


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
  const chainId = rest.value as ChainId
  const { isReady } = useIsWalletReady(chainId)

  return (
    <div className={clsx(widgetClasses.grayRoundedBox, widgetClasses.boxHoverAnimation)}>
      <TextField {...rest} className={clsx(classes.select, rest.className)}>
        {filteredChains.map((chain) => createChainMenuItem(chain, rest.label, rest.value === chain.id, classes))}
      </TextField>
      <WalletStatusButton chainId={chainId} isReady={isReady} />
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

const WalletStatusButton = ({ chainId, isReady }: { chainId: ChainId; isReady: boolean }) => {
  const classes = useStyles()
  const widgetClasses = useWidgetStyles()
  const activationKeyRef = useRef(0)
  const wasReadyRef = useRef(isReady)

  if (isReady && !wasReadyRef.current) {
    activationKeyRef.current += 1
  }
  wasReadyRef.current = isReady

  if (!isReady) {
    return null
  }

  const activationKey = activationKeyRef.current

  return (
    <button
      type="button"
      className={clsx(classes.chainSelectLabelButton, widgetClasses.compactRoundedButton, classes.statusButton)}
    >
      <SuccessPulse
        isActive
        activationKey={activationKey}
        className={classes.statusPulse}
      >
        <div className={classes.statusWalletContent}>
          <AccountBalanceWalletOutlined style={{ fontSize: '16px' }} color="inherit" />
          <ConnectedChainAccount chainId={chainId} />
        </div>
      </SuccessPulse>
    </button>
  )
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

const useStyles = makeStyles((theme) => ({
  select: {
    '& .MuiInputBase-root': {
      border: 'none',
      '&:hover fieldset': {
        border: 'none !important'
      },
    },

    '& .MuiSelect-root': {
      display: 'flex',
      alignItems: 'center',
      padding: 0
    },


    '& fieldset': {
      border: 'none',
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
    fontWeight: 500
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
    top: '50%'
  },
  statusButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    gap: '8px',
    overflow: 'visible'
  },
  statusPulse: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '24px',
    overflow: 'visible'
  },
  statusWalletContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }
}))
