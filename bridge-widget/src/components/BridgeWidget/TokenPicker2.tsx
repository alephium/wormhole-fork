import type { ChainId } from '@alephium/wormhole-sdk'
import {
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { makeStyles } from 'tss-react/mui';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import RefreshIcon from '@mui/icons-material/Refresh'
import { Alert } from '@mui/material'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import { useTranslation } from 'react-i18next'
import type { NFTParsedTokenAccount } from '../../store/nftSlice'
import { balancePretty } from '../../utils/balancePretty'
import { getIsTokenTransferDisabled } from '../../utils/consts'
import { shortenAddress } from '../../utils/addresses'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferAmount,
  selectTransferIsTokenPickerDialogOpen,
  selectTransferSourceChain,
  selectTransferSourceError,
  selectTransferTargetChain
} from '../../store/selectors'
import { setAmount } from '../../store/transferSlice'
import { closeTokenPickerDialog } from '../../store/widgetSlice'
import { RED, useWidgetStyles } from './styles'
import { COLORS } from '../../muiTheme'
import useIsWalletReady from '../../hooks/useIsWalletReady'

export const BasicAccountRender2 = (
  account: MarketParsedTokenAccount,
  isMigrationEligible: (address: string) => boolean,
  nft: boolean,
  displayBalance?: (account: NFTParsedTokenAccount) => boolean
) => {
  const { t } = useTranslation()
  const { classes } = useStyles()
  const mintPrettyString = shortenAddress(account.mintKey)
  const uri = nft ? account.image_256 : account.logo || account.uri
  const symbol = account.symbol || t('Unknown')
  const name = account.name || t('Unknown')
  const tokenId = account.tokenId
  const shouldDisplayBalance = !displayBalance || displayBalance(account)

  const nftContent = (
    <div className={classes.tokenOverviewContainer}>
      <div className={classes.tokenImageContainer}>
        {uri && <img alt="" className={classes.tokenImage} src={uri} />}
      </div>
      <div>
        <Typography>{symbol}</Typography>
        <Typography>{name}</Typography>
      </div>
      <div>
        <Typography>{mintPrettyString}</Typography>
        <Typography style={{ wordBreak: 'break-all' }}>{tokenId}</Typography>
      </div>
    </div>
  )

  const tokenContent = (
    <div className={classes.tokenOverviewContainer}>
      <div className={classes.tokenImageAndSymbol}>
        <div className={classes.tokenImageContainer}>
          {uri && <img alt="" className={classes.tokenImage} src={uri} />}
        </div>
        <div>
          <Typography variant="subtitle1">{symbol}</Typography>
        </div>
      </div>
      <div className={classes.tokenAddress}>
        <Typography variant="body1" style={{ opacity: 0.5 }}>
          {account.isNativeAsset ? 'Native' : mintPrettyString}
        </Typography>
      </div>
      <div>
        {shouldDisplayBalance ? (
          <>
            <Typography variant="body2" style={{ opacity: 0.5 }}>
              {'Balance'}
            </Typography>
            <Typography variant="body1">{balancePretty(account.uiAmountString)}</Typography>
          </>
        ) : (
          <div />
        )}
      </div>
    </div>
  )

  const migrationRender = (
    <div className={classes.migrationAlert}>
      <Alert severity="warning">
        <Typography variant="body2">{t('This is a legacy asset eligible for migration.')}</Typography>
        <div>{tokenContent}</div>
      </Alert>
    </div>
  )

  return nft ? nftContent : isMigrationEligible(account.mintKey) ? migrationRender : tokenContent
}

interface MarketParsedTokenAccount extends NFTParsedTokenAccount {
  markets?: string[]
}

type TokenPicker2Props = {
  value: NFTParsedTokenAccount | null
  options: NFTParsedTokenAccount[]
  RenderOption: ({ account }: { account: NFTParsedTokenAccount }) => JSX.Element
  onChange: (newValue: NFTParsedTokenAccount | null) => Promise<void>
  isValidAddress?: (address: string) => boolean
  getAddress?: (address: string, tokenId?: string) => Promise<NFTParsedTokenAccount>
  disabled: boolean
  resetAccounts: (() => void) | undefined
  nft: boolean
  chainId: ChainId
  error?: string
  showLoader?: boolean
  useTokenId?: boolean
}

const TokenPicker2 = function TokenPicker2({
  value,
  options,
  RenderOption,
  onChange,
  isValidAddress,
  getAddress,
  disabled,
  resetAccounts,
  nft,
  chainId,
  error: externalError,
  showLoader,
  useTokenId
}: TokenPicker2Props) {
  const { t } = useTranslation()
  const { classes } = useStyles()
  const [holderString, setHolderString] = useState('')
  const [tokenIdHolderString, setTokenIdHolderString] = useState('')
  const [loadingError, setLoadingError] = useState('')
  const [isLocalLoading, setLocalLoading] = useState(false)
  const [dialogIsOpen, setDialogIsOpen] = useState(false)
  const [selectionError, setSelectionError] = useState('')
  const transferSourceError = useSelector(selectTransferSourceError)
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { isReady: isSourceReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetReady } = useIsWalletReady(targetChain)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const dispatch = useDispatch()
  const dialogRequest = useSelector(selectTransferIsTokenPickerDialogOpen)
  const amount = useSelector(selectTransferAmount)

  const openDialog = useCallback(() => {
    setHolderString('')
    setSelectionError('')
    setDialogIsOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setDialogIsOpen(false)
    dispatch(closeTokenPickerDialog())
  }, [dispatch])

  const walletsReady = isSourceReady && isTargetReady
  const selectedToken = value
  const selectedTokenAmount = selectedToken?.uiAmountString
  const activeErrorMessage = transferSourceError || externalError
  const amountGreaterThanZero = !!amount && parseFloat(amount) > 0
  const hasError = amountGreaterThanZero && !!activeErrorMessage

  useEffect(() => {
    if (dialogRequest && !dialogIsOpen) {
      openDialog()
      dispatch(closeTokenPickerDialog())
    }
  }, [dialogRequest, dialogIsOpen, openDialog, dispatch])

  useLayoutEffect(() => {
    if (!walletsReady || !selectedToken || dialogIsOpen || typeof window === 'undefined') {
      return
    }

    const input = amountInputRef.current
    if (!input) {
      return
    }

    const frame = window.requestAnimationFrame(() => input.focus({ preventScroll: true }))

    return () => window.cancelAnimationFrame(frame)
  }, [walletsReady, dialogIsOpen, selectedToken])

  const handleSelectOption = useCallback(
    async (option: NFTParsedTokenAccount) => {
      setSelectionError('')
      let newOption: NFTParsedTokenAccount | null = null
      try {
        //Covalent balances tend to be stale, so we make an attempt to correct it at selection time.
        if (getAddress && !option.isNativeAsset) {
          newOption = await getAddress(option.mintKey, option.tokenId)
          newOption = {
            ...option,
            ...newOption,
            // keep logo and uri from covalent / market list / etc (otherwise would be overwritten by undefined)
            logo: option.logo || newOption.logo,
            uri: option.uri || newOption.uri
          } as NFTParsedTokenAccount
        } else {
          newOption = option
        }
        await onChange(newOption)
        closeDialog()
      } catch (e: any) {
        if (e.message?.includes('v1')) {
          setSelectionError(e.message)
        } else {
          setSelectionError(
            t(
              'Unable to retrieve required information about this token. Ensure your wallet is connected, then refresh the list.'
            )
          )
        }
      }
    },
    [getAddress, onChange, closeDialog, t]
  )

  const resetAccountsWrapper = useCallback(() => {
    setHolderString('')
    setTokenIdHolderString('')
    setSelectionError('')
    resetAccounts?.()
  }, [resetAccounts])

  const searchFilter = useCallback(
    (option: NFTParsedTokenAccount) => {
      if (!holderString) {
        return true
      }
      const optionString = (
        (option.publicKey || '') +
        ' ' +
        (option.mintKey || '') +
        ' ' +
        (option.symbol || '') +
        ' ' +
        (option.name || ' ')
      ).toLowerCase()
      const searchString = holderString.toLowerCase()
      return optionString.includes(searchString)
    },
    [holderString]
  )

  const nonFeaturedOptions = useMemo(() => {
    return options.filter((option: NFTParsedTokenAccount) => searchFilter(option))
  }, [options, searchFilter])

  const localFind = useCallback(
    (address: string, tokenIdHolderString: string) => {
      return options.find(
        (x) =>
          x.mintKey.toLowerCase() === address.toLowerCase() &&
          (!tokenIdHolderString || x.tokenId === tokenIdHolderString)
      )
    },
    [options]
  )

  //This is the effect which allows pasting an address in directly
  useEffect(() => {
    if (!isValidAddress || !getAddress) {
      return
    }
    if (useTokenId && !tokenIdHolderString) {
      return
    }
    setLoadingError('')
    let cancelled = false
    if (isValidAddress(holderString)) {
      const option = localFind(holderString, tokenIdHolderString)
      if (option) {
        handleSelectOption(option)
        return () => {
          cancelled = true
        }
      }
      setLocalLoading(true)
      setLoadingError('')
      getAddress(holderString, useTokenId ? tokenIdHolderString : undefined).then(
        (result) => {
          if (!cancelled) {
            setLocalLoading(false)
            if (result) {
              handleSelectOption(result)
            }
          }
        },
        (error) => {
          if (!cancelled) {
            setLocalLoading(false)
            setLoadingError(t('Could not find the specified address.'))
          }
        }
      )
    }
    return () => (cancelled = true)
  }, [holderString, isValidAddress, getAddress, handleSelectOption, localFind, tokenIdHolderString, useTokenId, t])

  //TODO reset button
  //TODO debounce & save hotloaded options as an option before automatically selecting
  //TODO sigfigs function on the balance strings

  const localLoader = (
    <div className={classes.alignCenter}>
      <CircularProgress />
      <Typography variant="body2">{showLoader ? t('Loading available tokens') : t('Searching for results')}</Typography>
    </div>
  )

  const displayLocalError = (
    <div className={classes.alignCenter}>
      <Typography variant="body2" color="error">
        {loadingError || selectionError}
      </Typography>
    </div>
  )

  const dialog = (
    <Dialog onClose={closeDialog} aria-labelledby="simple-dialog-title" open={dialogIsOpen} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div id="simple-dialog-title" className={classes.flexTitle}>
          <Typography variant="h6">{t('Available tokens')}</Typography>
          <div className={classes.grower} />
          <Tooltip title="Reload tokens">
            <IconButton onClick={resetAccountsWrapper} size="large">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <TextField
          variant="outlined"
          value={holderString}
          onChange={(event) => setHolderString(event.target.value)}
          fullWidth
          placeholder={t('Search name or paste address')}
          margin="normal"
        />
        {useTokenId ? (
          <TextField
            variant="outlined"
            label={t('Token ID')}
            value={tokenIdHolderString}
            onChange={(event) => setTokenIdHolderString(event.target.value)}
            fullWidth
            margin="normal"
          />
        ) : null}
        {isLocalLoading || showLoader ? (
          localLoader
        ) : loadingError || selectionError ? (
          displayLocalError
        ) : (
          <List component="div" className={classes.tokenList}>
            {nonFeaturedOptions.map((option) => {
              return (
                <ListItemButton
                  component="div"

                  onClick={() => handleSelectOption(option)}
                  key={option.publicKey + option.mintKey + (option.tokenId || '')}
                  disabled={getIsTokenTransferDisabled(chainId, option.mintKey)}
                  className={classes.tokenListItem}
                >
                  <RenderOption account={option} />
                </ListItemButton>
              )
            })}

            {nonFeaturedOptions.length ? null : (
              <div className={classes.emptyPlaceholder}>
                <Typography>{t('No results found')}</Typography>
              </div>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )

  const { classes: widgetClasses } = useWidgetStyles()

  return (
    <>
      {dialog}
      <div className={widgetClasses.inputFieldContainer}>
        <div className={widgetClasses.inputFieldContainerInner}>
          <input
            ref={amountInputRef}
            className={classes.tokenAmountValueInput}
            inputMode="decimal"
            minLength={1}
            maxLength={79}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            pattern="^[0-9]*[.,]?[0-9]*$"
            id="amount"
            placeholder="0"
            type="text"
            value={amount}
            name="amount"
            onChange={(event) => dispatch(setAmount(event.target.value))}
            style={{ color: hasError ? RED : 'white' }}
            disabled={!walletsReady}
          />

          <button className={widgetClasses.compactRoundedButton} onClick={openDialog}>
            <TokenIconSymbol account={selectedToken} />
          </button>
        </div>
        <div className={classes.tokenAmountControls}>
          <div className={classes.tokenAvailableMaxContainer}>
            <button
              onClick={() => dispatch(setAmount(selectedTokenAmount || ''))}
              className={widgetClasses.discreetButton}
            >
              Max: {balancePretty(selectedTokenAmount || '')}
            </button>
          </div>
        </div>
        {hasError && <div style={{ color: RED }}>{activeErrorMessage}</div>}
      </div>
    </>
  )
}

export const TokenIconSymbol = ({
  account
}: {
  account: { logo?: string | null; uri?: string | null; symbol?: string | null } | null
}) => {
  const { classes } = useStyles()
  const { classes: widgetClasses } = useWidgetStyles()
  const uri = account?.logo || account?.uri
  const symbol = account?.symbol || '-'

  return (
    <div className={widgetClasses.tokenIconSymbolContainer}>
      <div className={classes.tokenImageContainer2}>
        {uri && <img alt="" className={classes.tokenImage2} src={uri} />}
      </div>
      <div>
        <Typography style={{ fontWeight: 'bold' }}>{symbol}</Typography>
      </div>
      <KeyboardArrowDownIcon />
    </div>
  )
}

export default TokenPicker2

const useStyles = makeStyles()((theme) => ({
    alignCenter: {
      textAlign: 'center'
    },
    optionContainer: {
      padding: 0
    },
    optionContent: {
      padding: theme.spacing(1)
    },
    tokenList: {
      maxHeight: theme.spacing(80), //TODO smarter
      height: theme.spacing(80),
      overflow: 'auto',
      padding: 0
    },
    dialogContent: {
      overflowX: 'hidden'
    },
    selectionButtonContainer: {
      textAlign: 'center',
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2)
    },
    selectionButton: {
      maxWidth: '100%',
      width: theme.breakpoints.values.sm
    },
    tokenListItem: {
      paddingLeft: '10px'
    },
    tokenOverviewContainer: {
      display: 'flex',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      '& >div': {
        margin: theme.spacing(1),
        [theme.breakpoints.down('sm')]: {
          margin: 0
        },
        flexBasis: '25%',
        '&$tokenMarketsList': {
          marginTop: theme.spacing(-0.5),
          marginLeft: 0,
          flexBasis: '100%'
        },
        '&:last-child': {
          textAlign: 'right'
        },
        flexShrink: 1
      }
    },
    tokenImageAndSymbol: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      [theme.breakpoints.down('sm')]: {
        gap: '10px'
      }
    },
    tokenAddress: {
      [theme.breakpoints.down('sm')]: {
        display: 'none'
      }
    },
    tokenImageContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      maxWidth: 40,
      borderRadius: '50%',
      padding: 6,
      border: `1px solid ${COLORS.whiteWithTransparency}`,
      overflow: 'hidden',
      flexShrink: 0
    },
    tokenImageContainer2: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20
    },
    tokenImage: {
      maxHeight: '2.5rem'
    },
    tokenImage2: {
      maxHeight: '1rem',
      maxWidth: '100%'
    },
    tokenMarketsList: {
      order: 1,
      textAlign: 'left',
      width: '100%',
      '& > .MuiButton-root': {
        marginTop: theme.spacing(1),
        marginRight: theme.spacing(1)
      }
    },
    migrationAlert: {
      width: '100%',
      '& .MuiAlert-message': {
        width: '100%'
      }
    },
    flexTitle: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center'
    },
    grower: {
      flexGrow: 1
    },
    emptyPlaceholder: {
      padding: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.gray
    },
    tokenAmountControls: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'space-between'
    },
    tokenAvailableMaxContainer: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      justifyContent: 'flex-end'
    },
    useMaxButton: {
      fontSize: '0.875rem'
    },
    tokenAmountValue: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    tokenAmountValueInput: {
      marginLeft: '0.125rem',
      display: 'block',
      width: '100%',
      boxShadow: 'none',
      backgroundColor: 'transparent',
      fontSize: '2.25rem',
      lineHeight: 1,
      border: 'none',
      outline: 'none',
      '&:focus': {
        outline: 'none'
      },
      '&:hover': {
        outline: 'none'
      },
      color: '#fff',
      fontFeatureSettings: 'tnum'
    }
  })
)
