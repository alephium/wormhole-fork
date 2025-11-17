import {
  ListItemIcon,
  ListItemText,
  MenuItem,
  OutlinedTextFieldProps,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui';
import clsx from 'clsx'
import { ReactNode, useMemo } from 'react'
import { getConst, ChainInfo } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, ChainName, isEVMChain, toChainName } from '@alephium/wormhole-sdk'
import { useConnect, useWallet } from '@alephium/web3-react'
import { useEthereumProvider } from '../../contexts/EthereumProviderContext'
import { GRAY, useWidgetStyles } from './styles'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import SuccessPulse from './SuccessPulse'
import WalletAddressButton from '../WalletAddressButton'
import { shortenAddress } from '../../utils/addresses'

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
        <ListItemText className={classes.listItemValue} primary={name} />
      </div>
    </MenuItem>
  )
}

interface ChainSelectProps extends OutlinedTextFieldProps {
  chains: ChainInfo[]
}

const ChainSelect2 = ({ chains, ...rest }: ChainSelectProps) => {
  const { classes } = useStyles()
  const { classes: widgetClasses } = useWidgetStyles()
  const filteredChains = useMemo(
    () => chains.filter(({ id }) => !getConst('BETA_CHAINS').includes(id)),
    [chains]
  )
  const chainId = rest.value as ChainId
  const { isReady } = useIsWalletReady(chainId)

  return (
    <div className={clsx(classes.selectWrapper, widgetClasses.boxHoverAnimation)}>
      <TextField {...rest} className={clsx(classes.select, rest.className)}>
        {filteredChains.map((chain) => createChainMenuItem(chain, rest.label, rest.value === chain.id, classes))}
      </TextField>
      <WalletStatusButton chainId={chainId} isReady={isReady} />
    </div>
  )
}

export default ChainSelect2

const Label = ({ children }: { children: React.ReactNode }) => (
  <Typography style={{ fontSize: '14px', color: GRAY }}>{children}</Typography>
)

type ConnectedAccountStyles = {
  labelClassName?: string
}

type ConnectedAccountProps = ConnectedAccountStyles & {
  chainName: string
}

const ConnectedChainAccount = ({ chainId, labelClassName }: { chainId: ChainId } & ConnectedAccountStyles) => {
  const chainName = getConst('CHAINS_BY_ID')[chainId]?.name ?? 'Wallet'
  const accountProps: ConnectedAccountProps = {
    labelClassName,
    chainName
  }

  if (isEVMChain(chainId)) {
    return <CurrentlyConnectedEVMAccount {...accountProps} />
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return <CurrentlyConnectedAlephiumAccount {...accountProps} />
  }

  return null
}

const WalletStatusButton = ({ chainId, isReady }: { chainId: ChainId; isReady: boolean }) => {
  const { classes } = useStyles()
  if (!isReady) return null

  return (
    <div className={classes.activeWalletButton}>
      <SuccessPulse
        className={classes.statusPulse}
        contentClassName={classes.statusContent}
      >
        <ConnectedChainAccount
          chainId={chainId}
          labelClassName={classes.accountAddress}
        />
      </SuccessPulse>
    </div>
  )
}

const CurrentlyConnectedEVMAccount = (props: ConnectedAccountProps) => {
  const { signerAddress, disconnect } = useEthereumProvider()
  return signerAddress ? (
    <AccountAddress address={signerAddress} disconnect={disconnect} {...props} />
  ) : null
}

const CurrentlyConnectedAlephiumAccount = (props: ConnectedAccountProps) => {
  const wallet = useWallet()
  const { disconnect } = useConnect()

  if (wallet.connectionStatus !== 'connected' || !wallet.account?.address) {
    return null
  }

  const handleDisconnect = () => disconnect()

  return <AccountAddress address={wallet.account.address} disconnect={handleDisconnect} {...props} />
}

const AccountAddress = ({
  address,
  disconnect,
  labelClassName,
  chainName
}: {
  address: string
  disconnect: () => void | Promise<void>
} & ConnectedAccountProps) => {
  const { classes } = useStyles()
  const shortAddress = shortenAddress(address)
  const resolvedLabelClassName = labelClassName ?? classes.accountAddress

  return (
    <WalletAddressButton
      address={address}
      onDisconnect={disconnect}
      chainName={chainName}
      iconType="generic"
    >
      <Typography className={resolvedLabelClassName}>{shortAddress}</Typography>
    </WalletAddressButton>
  )
}

const useStyles = makeStyles()((theme) => ({
  selectWrapper: {
    position: 'relative',
    background: 'transparent',
    borderRadius: '16px',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  select: {
    '& .MuiOutlinedInput-root fieldset': {
      border: 'none',
      '&:hover fieldset': {
        border: 'none !important'
      },
    },

    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      padding: 0
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
    width: 50,
    height: 50,
    minWidth: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px'
  },
  icon: {
    height: 30,
    width: 30
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
    [theme.breakpoints.down('sm')]: {
      display: 'none'
    }
  },
  modalTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  activeWalletButton: {
    position: 'absolute',
    right: 0,
    transform: 'translateY(-50%)',
    top: '50%'
  },
  statusPulse: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '24px',
    overflow: 'visible'
  },
  statusContent: {
    display: 'inline-flex'
  }
}))
