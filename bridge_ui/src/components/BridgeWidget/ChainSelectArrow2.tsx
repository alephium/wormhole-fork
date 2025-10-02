import { IconButton } from '@material-ui/core'
import { ArrowForward, SwapHoriz } from '@material-ui/icons'
import { useState } from 'react'
import { COLORS, theme } from '../../muiTheme';

export default function ChainSelectArrow2({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [showSwap, setShowSwap] = useState(false)

  return (
    <IconButton
      style={{
        color: theme.palette.grey[600],
        border: `1px solid ${COLORS.whiteWithTransparency}`,
        outline: `6px solid ${COLORS.darkGrey}`,
        backgroundColor: COLORS.darkGrey,
        width: '30px',
        height: '30px',
      }}
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
