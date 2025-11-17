import { useDispatch, useSelector } from 'react-redux'
import ChainSelect2 from './ChainSelect2'
import ChainSelectArrow2 from './ChainSelectArrow2'
import Divider from './Divider'
import { useWidgetStyles } from './styles'
import clsx from 'clsx'
import {
  selectTransferShouldLockFields,
  selectTransferSourceChain,
  selectTransferTargetChain
} from '../../store/selectors'
import { useCallback, useMemo } from 'react'
import { setSourceChain, setTargetChain } from '../../store/transferSlice'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import { getConst } from '../../utils/consts'
import { makeStyles } from 'tss-react/mui'
import { COLORS } from '../../muiTheme'
import useIsWalletReady from '../../hooks/useIsWalletReady'

const ChainSelectors = () => {
  const { classes } = useStyles()
  const { classes: widgetClasses } = useWidgetStyles()
  const dispatch = useDispatch()
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { isReady: isTargetChainReady } = useIsWalletReady(targetChain)
  const { isReady: isSourceChainReady } = useIsWalletReady(sourceChain)
  const shouldLockFields = useSelector(selectTransferShouldLockFields)
  const CHAINS = getConst('CHAINS')
  const sourceChainOptions = useMemo(
    () => CHAINS.filter((c) => (targetChain !== CHAIN_ID_ALEPHIUM ? c.id === CHAIN_ID_ALEPHIUM : c.id !== targetChain)),
    [targetChain]
  )
  const targetChainOptions = useMemo(
    () => CHAINS.filter((c) => (sourceChain !== CHAIN_ID_ALEPHIUM ? c.id === CHAIN_ID_ALEPHIUM : c.id !== sourceChain)),
    [sourceChain]
  )
  const handleSourceChange = useCallback(
    (event: any) => {
      dispatch(setSourceChain(event.target.value))
    },
    [dispatch]
  )

  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value))
    },
    [dispatch]
  )

  return (
    <div
      className={clsx(widgetClasses.grayRoundedBox, classes.chainSelectWrapper)}
      style={{ borderColor: isSourceChainReady && isTargetChainReady ? 'transparent' : COLORS.whiteWithTransparency }}
    >
      <div className={widgetClasses.chainSelectContainer}>
        <ChainSelect2
          label="From"
          select
          variant="outlined"
          value={sourceChain}
          onChange={handleSourceChange}
          disabled={shouldLockFields}
          chains={sourceChainOptions}
        />
      </div>
      <Divider className={classes.chainDivider}>
        <div className={classes.chainSelectArrow}>
          <ChainSelectArrow2
            onClick={() => {
              dispatch(setSourceChain(targetChain))
            }}
            disabled={shouldLockFields}
          />
        </div>
      </Divider>
      <div className={widgetClasses.chainSelectContainer}>
        <ChainSelect2
          label="To"
          variant="outlined"
          select
          value={targetChain}
          onChange={handleTargetChange}
          disabled={shouldLockFields}
          chains={targetChainOptions}
        />
      </div>
    </div>
  )
}

export default ChainSelectors

const useStyles = makeStyles()((theme) => ({
  chainSelectWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    gap: '24px'
  },
  chainDivider: {
    width: '100%',
    position: 'relative',
    height: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  chainSelectArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%) rotate(90deg)',
    [theme.breakpoints.down('sm')]: {
      right: theme.spacing(1)
    }
  }
}))
