import { ButtonBase, List, ListItemButton, ListItemText, Popover, PopoverOrigin, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { AccountBalanceWalletOutlined } from '@mui/icons-material'
import clsx from 'clsx'
import { MouseEvent, ReactNode, useMemo, useState } from 'react'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { getConst } from '../utils/consts'
import Divider from './BridgeWidget/Divider'
import { COLORS } from '../muiTheme'

const defaultAnchorOrigin: PopoverOrigin = { vertical: 'bottom', horizontal: 'left' }
const defaultTransformOrigin: PopoverOrigin = { vertical: 'top', horizontal: 'left' }

type WalletAddressButtonProps = {
  address: string
  onDisconnect: () => void | Promise<void>
  chainName: string
  iconType: 'generic' | 'chainLogo'
  children: ReactNode
  buttonClassName?: string
  onlyShowChainIcon?: boolean
  disableDisconnect?: boolean
}

const WalletAddressButton = ({
  address,
  onDisconnect,
  chainName,
  iconType,
  children,
  buttonClassName,
  onlyShowChainIcon = false,
  disableDisconnect = false
}: WalletAddressButtonProps) => {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const copyToClipboard = useCopyToClipboard(address)
  const open = !!anchorEl

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleCopy = () => {
    copyToClipboard()
    handleClose()
  }

  const handleDisconnect = () => {
    if (disableDisconnect) {
      return
    }
    Promise.resolve(onDisconnect())
      .catch(() => undefined)
      .finally(handleClose)
  }

  const chainLogoSrc = useMemo(() => {
    if (iconType !== 'chainLogo') {
      return undefined
    }
    const info = getConst('CHAINS').find(({ name }) => name === chainName)
    return info?.logo
  }, [chainName, iconType])

  const iconElement = useMemo(() => {
    if (iconType === 'chainLogo' && chainLogoSrc) {
      return <img src={chainLogoSrc} alt={chainName} className={classes.chainLogoImage} />
    }
    return <AccountBalanceWalletOutlined fontSize="small" />
  }, [chainLogoSrc, chainName, classes.chainLogoImage, iconType])

  const showLabelOnButton = !onlyShowChainIcon
  const labelContent = children
  const labelText = typeof labelContent === 'string' ? labelContent : address
  const headerSubtitle = onlyShowChainIcon ? address : labelText
  const buttonAriaLabel = `${chainName} wallet`

  return (
    <>
      <ButtonBase
        className={clsx(onlyShowChainIcon && classes.buttonIconOnly, buttonClassName || classes.button)}
        onClick={handleOpen}
        type="button"
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        aria-label={buttonAriaLabel}
      >
        {iconElement ? (
          <span className={clsx(classes.iconWrapper, iconType === 'chainLogo' ? classes.chainLogoIcon : classes.genericIcon)}>
            {iconElement}
          </span>
        ) : null}
        {showLabelOnButton ? <span className={classes.labelWrapper}>{labelContent}</span> : null}
      </ButtonBase>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={defaultAnchorOrigin}
        transformOrigin={defaultTransformOrigin}
        className={classes.popoverPaper}
      >
        <div className={classes.popoverHeader}>
          <Typography className={classes.popoverTitle}>{`${chainName} wallet`}</Typography>
          {headerSubtitle ? <Typography className={classes.popoverSubtitle}>{headerSubtitle}</Typography> : null}
        </div>
        <Divider />
        <List>
          <ListItemButton onClick={handleCopy}>
            <ListItemText primary="Copy address" />
          </ListItemButton>
          <ListItemButton disabled={disableDisconnect} onClick={disableDisconnect ? undefined : handleDisconnect}>
            <ListItemText primary="Disconnect" secondary={disableDisconnect ? 'Complete bridging to disconnect.' : undefined} />
          </ListItemButton>
        </List>
      </Popover>
    </>
  )
}

export default WalletAddressButton

const useStyles = makeStyles()((theme) => ({
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    textAlign: 'left',
    borderRadius: 9,
    backgroundColor: COLORS.whiteWithStrongTransparency,
    padding: theme.spacing(0.7, 1.1),
    color: COLORS.whiteWithMediumTransparency
  },
  buttonIconOnly: {
    gap: 0,
    padding: theme.spacing(0.75, 1)
  },
  iconWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    height: 18,
    width: 18,

    '& svg': {
      fontSize: '1rem'
    }
  },
  genericIcon: {
    color: 'inherit'
  },
  chainLogoIcon: {
    borderRadius: '50%'
  },
  chainLogoImage: {
    width: 18,
    height: 18,
    display: 'block'
  },
  labelWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0
  },
  popoverPaper: {
    minWidth: 200,
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5)
  },
  popoverHeader: {
    padding: theme.spacing(0.5)
  },
  popoverTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: theme.spacing(0.5)
  },
  popoverSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    wordBreak: 'break-all'
  }
}))
