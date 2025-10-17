import { IconButton, makeStyles } from '@material-ui/core'
import { ArrowForward, SwapHoriz } from '@material-ui/icons'
import { useState } from 'react'
import { COLORS } from '../../muiTheme';

interface ChainSelectArrow2Props {
  onClick: () => void
  disabled: boolean
}

const ChainSelectArrow2 = ({ onClick, disabled }: ChainSelectArrow2Props) => {
  const [showSwap, setShowSwap] = useState(false)
  const classes = useStyles()

  return (
    <IconButton
      className={classes.button}
      onClick={onClick}
      onMouseEnter={() => {
        setShowSwap(true)
      }}
      onMouseLeave={() => {
        setShowSwap(false)
      }}
      disabled={disabled}
    >
      {showSwap ? <SwapHoriz fontSize="small" /> : <ArrowForward fontSize="small" />}
    </IconButton>
  )
}

export default ChainSelectArrow2

const useStyles = makeStyles((theme) => ({
  button: {
    color: theme.palette.grey[600],
    border: `1px solid ${COLORS.whiteWithTransparency}`,
    outline: `6px solid ${COLORS.darkGrey}`,
    backgroundColor: COLORS.darkGrey,
    width: 32,
    height: 32,
    borderRadius: 10,
    transition: 'border-radius 0.2s ease, width 0.2s ease, height 0.2s ease, outline-width 0.2s ease'
  }
}))
