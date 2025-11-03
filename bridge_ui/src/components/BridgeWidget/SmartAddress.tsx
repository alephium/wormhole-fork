import {
  ChainId,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_KARURA,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALEPHIUM
} from '@alephium/wormhole-sdk'
import { Button, makeStyles, Tooltip, Typography } from '@material-ui/core'
import { FileCopy, OpenInNew } from '@material-ui/icons'
import { withStyles } from '@material-ui/styles'
import { ReactChild, useState } from 'react'
import useCopyToClipboard from '../../hooks/useCopyToClipboard'
import { ParsedTokenAccount } from '../../store/transferSlice'
import { CLUSTER, WETH_ADDRESS, getExplorerName } from '../../utils/consts'
import { shortenAddress } from '../../utils/addresses'
import { addressFromContractId, ALPH_TOKEN_ID, isBase58 } from '@alephium/web3'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const useStyles = makeStyles((theme) => ({
  mainTypog: {
    display: 'inline-block',
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    textDecoration: 'underline',
    textUnderlineOffset: '2px'
  },
  noGutter: {
    marginLeft: 0,
    marginRight: 0
  },
  noUnderline: {
    textDecoration: 'none'
  },
  buttons: {
    marginLeft: '.5rem',
    marginRight: '.5rem'
  },
  address: {
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    textDecorationColor: 'rgba(255, 255, 255, 0.7)',
    textDecorationThickness: '1px',
    textDecorationStyle: 'dotted',
    '&:hover': {
      color: 'rgba(255, 255, 255, 0.7)'
    }
  },
  compactAddress: {
    fontSize: '0.8rem',
    fontWeight: 400
  },
  '@keyframes pulseDot': {
    '0%': {
      opacity: 1
    },
    '60%': {
      opacity: 0.6
    },
    '100%': {
      opacity: 1
    }
  },
  '@keyframes rippleWave': {
    '0%': {
      transform: 'translate(-50%, -50%) scale(0.6)',
      opacity: 1,
      filter: 'blur(0)'
    },
    '70%': {
      transform: 'translate(-50%, -50%) scale(2.3)',
      opacity: 0.5,
      filter: 'blur(4px)'
    },
    '100%': {
      transform: 'translate(-50%, -50%) scale(2.8)',
      opacity: 0,
      filter: 'blur(4px)'
    }
  },
  pulsingDot: {
    animation: '$pulseDot 2s infinite ease-out',
    backgroundColor: '#4da3ff',
    borderRadius: '50%',
    display: 'inline-block',
    position: 'relative',
    height: '5px',
    width: '5px',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      backgroundColor: '#4da3ff',
      transform: 'translate(-50%, -50%) scale(1)',
      animation: '$rippleWave 2s infinite ease-out',
      filter: 'blur(2px)'
    }
  }
}))

const tooltipStyles = {
  tooltip: {
    textAlign: 'center',
    '& > *': {
      margin: '.25rem'
    }
  }
}

// @ts-ignore
const StyledTooltip = withStyles(tooltipStyles)(Tooltip)

interface SmartAddressProps {
  chainId: ChainId
  transactionAddress?: string
  parsedTokenAccount?: ParsedTokenAccount
  address?: string
  logo?: string
  tokenName?: string
  symbol?: string
  variant?: any
  noGutter?: boolean
  noUnderline?: boolean
  extraContent?: ReactChild
  isAsset?: boolean
  pulse?: boolean
  tooltipText?: string
  isCompact?: boolean
}

const SmartAddress = ({
  chainId,
  parsedTokenAccount,
  transactionAddress,
  address,
  symbol,
  tokenName,
  variant,
  extraContent,
  isAsset,
  pulse,
  tooltipText,
  isCompact
}: SmartAddressProps) => {
  const { t } = useTranslation()
  const classes = useStyles()
  const isNativeETH = chainId === CHAIN_ID_ETH && address?.toLowerCase() === WETH_ADDRESS.toLowerCase()
  const isNativeALPH = chainId === CHAIN_ID_ALEPHIUM && address === ALPH_TOKEN_ID
  const useableAddress = parsedTokenAccount?.mintKey || address || transactionAddress || ''
  const useableSymbol = isNativeETH ? 'ETH' : parsedTokenAccount?.symbol || symbol || ''
  // const useableLogo = logo || isNativeTerra ? getNativeTerraIcon(useableSymbol) : null
  const isNative = parsedTokenAccount?.isNativeAsset || isNativeETH || isNativeALPH || false
  const addressShort = shortenAddress(useableAddress) || ''

  const [isPulsing, setIsPulsing] = useState(pulse)

  const useableName = isNative
    ? 'Native Currency'
    : parsedTokenAccount?.name
    ? parsedTokenAccount.name
    : tokenName
    ? tokenName
    : ''
  const explorerAddress =
    isNative || useableAddress === ''
      ? null
      : chainId === CHAIN_ID_ETH
      ? `https://${CLUSTER === 'testnet' ? 'sepolia.' : ''}etherscan.io/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
      ? `https://${CLUSTER === 'testnet' ? 'ropsten.' : ''}etherscan.io/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_BSC
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}bscscan.com/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_POLYGON
      ? `https://${CLUSTER === 'testnet' ? 'mumbai.' : ''}polygonscan.com/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_AVAX
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}snowtrace.io/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_OASIS
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}explorer.emerald.oasis.dev/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_AURORA
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}aurorascan.dev/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_FANTOM
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}ftmscan.com/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_KLAYTN
      ? `https://${CLUSTER === 'testnet' ? 'baobab.' : ''}scope.klaytn.com/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_CELO
      ? `https://${CLUSTER === 'testnet' ? 'alfajores-blockscout.celo-testnet.org' : 'explorer.celo.org'}/${
          transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_KARURA
      ? `https://${CLUSTER === 'testnet' ? 'blockscout.karura-dev.aca-dev.network' : 'blockscout.karura.network'}/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_ACALA
      ? `https://${CLUSTER === 'testnet' ? 'blockscout.acala-dev.aca-dev.network' : 'blockscout.acala.network'}/${
          isAsset ? 'token' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_SOLANA
      ? `https://solscan.io/address/${useableAddress}${
          CLUSTER === 'testnet'
            ? '?cluster=devnet'
            : CLUSTER === 'devnet'
            ? '?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899'
            : ''
        }`
      : chainId === CHAIN_ID_TERRA
      ? `https://finder.terra.money/${
          CLUSTER === 'devnet' ? 'localterra' : CLUSTER === 'testnet' ? 'bombay-12' : 'columbus-5'
        }/address/${useableAddress}`
      : chainId === CHAIN_ID_ALGORAND
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : ''}algoexplorer.io/${
          isAsset ? 'asset' : transactionAddress ? 'tx' : 'address'
        }/${useableAddress}`
      : chainId === CHAIN_ID_ALEPHIUM
      ? `https://${CLUSTER === 'testnet' ? 'testnet.' : 'explorer.'}alephium.org/${
          transactionAddress ? 'transactions' : 'addresses'
        }/${transactionAddress || toALPHAddress(useableAddress)}`
      : undefined
  const explorerName = getExplorerName(chainId)

  const copyToClipboard = useCopyToClipboard(useableAddress)

  const explorerButton = !explorerAddress ? null : (
    <Button
      size="small"
      variant="outlined"
      startIcon={<OpenInNew />}
      className={classes.buttons}
      href={explorerAddress}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t('View on {{ explorerName }}', { explorerName })}
    </Button>
  )
  //TODO add icon here
  const copyButton = isNative ? null : (
    <Button
      size="small"
      variant="outlined"
      startIcon={<FileCopy />}
      onClick={copyToClipboard}
      className={classes.buttons}
    >
      {t('Copy')}
    </Button>
  )

  const tooltipContent = (
    <>
      {tooltipText && <Typography>{tooltipText}</Typography>}
      {useableName && <Typography>{useableName}</Typography>}
      {useableSymbol && !isNative && (
        <Typography noWrap variant="body2">
          {addressShort}
        </Typography>
      )}
      <div>
        {explorerButton}
        {copyButton}
      </div>
      {extraContent ? extraContent : null}
    </>
  )

  return (
    <StyledTooltip title={tooltipContent} interactive={true} onPointerEnter={() => setIsPulsing(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isPulsing && <span className={classes.pulsingDot} />}
        <Typography
          variant={variant || 'body1'}
          component="div"
          className={clsx(classes.address, { [classes.compactAddress]: isCompact })}
        >
          {useableSymbol || addressShort}
        </Typography>
      </div>
    </StyledTooltip>
  )
}

export default SmartAddress

function toALPHAddress(idOrAddress: string): string {
  return isBase58(idOrAddress) ? idOrAddress : addressFromContractId(idOrAddress)
}
