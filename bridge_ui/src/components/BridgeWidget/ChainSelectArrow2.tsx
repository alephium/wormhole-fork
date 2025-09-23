import { Button, IconButton } from '@material-ui/core'
import { ArrowForward, SwapHoriz } from '@material-ui/icons'
import { useState } from 'react'
import { GRAY } from './styles'
import { theme } from '../../muiTheme';

export default function ChainSelectArrow2({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [showSwap, setShowSwap] = useState(false)

  return (
    <IconButton
      style={{
        color: theme.palette.grey[600],
        border: '1px solid rgba(255, 255, 255, 0.06)',
        outline: '4px solid #101010',
        backgroundColor: 'rgb(30, 30, 30)',
        width: '32px',
        height: '32px',
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
