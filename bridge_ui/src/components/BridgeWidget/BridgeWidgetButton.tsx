import Button, { ButtonProps } from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { styled } from '@mui/material/styles'
import { COLORS } from '../../muiTheme'

export type BridgeWidgetButtonProps = ButtonProps & {
  tone?: 'default' | 'primaryNext'
  isLoading?: boolean
  short?: boolean
}

const BridgeWidgetButton = ({
  className,
  variant = 'contained',
  tone = 'default',
  isLoading,
  short,
  ...props
}: BridgeWidgetButtonProps) => (
  <ButtonStyled className={className} variant={variant} color="primary" fullWidth tone={tone} short={short} {...props}>
    {isLoading ? <CircularProgress size={20} color="inherit" /> : props.children}
  </ButtonStyled>
)

export default BridgeWidgetButton

const ButtonStyled = styled(Button, {
  // prevent custom props from reaching the DOM
  shouldForwardProp: (prop) => prop !== 'tone' && prop !== 'short'
})<BridgeWidgetButtonProps>(({ tone = 'default', short }) => ({
  textTransform: 'none',
  borderRadius: short ? '12px' : '16px',
  height: short ? '36px' : '52px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 550,
  fontSize: '16px',
  letterSpacing: 'normal',
  transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',

  '&.MuiButton-containedPrimary': {
    backgroundColor: tone === 'primaryNext' ? COLORS.blue : COLORS.nearWhite,
    color: tone === 'primaryNext' ? COLORS.white : COLORS.nearBlack,
    '&:hover': {
      transform: 'scale(1.005)',
      backgroundColor: tone === 'primaryNext' ? COLORS.blue : COLORS.white,
      color: tone === 'primaryNext' ? COLORS.white : COLORS.nearBlack,
      filter: 'brightness(1.1)'
    }
  },

  '&.MuiButton-outlinedPrimary': {
    backgroundColor: COLORS.whiteWithStrongTransparency,
    borderColor: COLORS.whiteWithStrongTransparency,
    color: COLORS.nearWhite,
    '&:hover': {
      transform: 'scale(1.005)',
      color: COLORS.white,
      backgroundColor: COLORS.whiteWithTransparency
    }
  },

  '&.Mui-disabled': {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    color: 'rgba(0, 0, 0, 0.35)'
  }
}))
