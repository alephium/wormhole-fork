import { makeStyles } from '@material-ui/core'
import { COLORS } from '../../muiTheme'

export const GRAY = 'rgba(255, 255, 255, 0.5)'
export const RED = '#ed4a34'
export const GREEN = '#189b3c'
export const BLUE = '#0045ff'
export const YELLOW = '#f0d590'
export const YELLOW_BG = 'rgba(240, 213, 144, 0.1)'

export const useWidgetStyles = makeStyles((theme) => ({
  grayRoundedBox: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    backgroundColor: COLORS.darkGrey,
    border: `1px solid ${COLORS.whiteWithTransparency}`,
    borderRadius: '20px',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',

    '&.secondary': {
      backgroundColor: COLORS.whiteWithStrongTransparency,
      border: `transparent`
    }
  },
  sendStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  sendStepContent: {
    fontSize: '16px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  sendStepContentSuccess: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.5)'
  },
  sendStepIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px'
  },
  spaceBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  expandButton: {
    color: GRAY,
    padding: '4px',
    width: '32px',
    height: '32px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(255, 255, 255, 0.8)'
    }
  },
  expandIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
  },
  expandIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: 'auto'
  },
  expandIconVisible: {
    opacity: 1,
    filter: 'blur(0)',
    animation: '$expandIconIn 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  expandIconHidden: {
    opacity: 0,
    filter: 'blur(2px)',
    animation: '$expandIconOut 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  expandableContainer: {
    overflow: 'hidden',
    transition: 'max-height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  },
  expanded: {
    maxHeight: '1000px',
    opacity: 1
  },
  collapsed: {
    maxHeight: '0px',
    opacity: 0
  },
  tokenIconSymbolContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px'
  },
  networkAddressText: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  },
  networkIcon: {
    height: '1rem',
    width: '1rem'
  },
  bridgingProgressRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px'
  },
  bridgingProgressIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px'
  },
  bridgingProgressContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    width: '100%'
  },
  progressDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    marginTop: theme.spacing(2)
  },
  boxHoverAnimation: {
    position: 'relative',
    '&:hover': {
      transform: 'scale(1.005)',
      filter: 'brightness(1.2)',
      cursor: 'pointer',
      '&:after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        margin: -10,
        backgroundColor: COLORS.whiteWithStrongTransparency,
        borderRadius: 16,
        pointerEvents: 'none'
      }
    }
  },

  pulseWrapper: {
    position: 'relative',
    display: 'flex',
    width: '100%'
  },
  pulseWrapperAnimated: {
    animation: '$successWrapperScale 260ms ease-out'
  },
  '@keyframes successWrapperScale': {
    '0%': {
      transform: 'scale(0.96)'
    },
    '60%': {
      transform: 'scale(1.01)'
    },
    '100%': {
      transform: 'scale(1)'
    }
  },
  '@keyframes expandIconIn': {
    '0%': {
      transform: 'scale(0.8)',
      filter: 'blur(2px)',
      opacity: 0
    },
    '50%': {
      transform: 'scale(1.2)',
      filter: 'blur(1px)',
      opacity: 0.5
    },
    '100%': {
      transform: 'scale(1)',
      filter: 'blur(0)',
      opacity: 1
    }
  },
  '@keyframes expandIconOut': {
    '0%': {
      transform: 'scale(1)',
      filter: 'blur(0)',
      opacity: 1
    },
    '50%': {
      transform: 'scale(0.8)',
      filter: 'blur(1px)',
      opacity: 0.5
    },
    '100%': {
      transform: 'scale(1)',
      filter: 'blur(2px)',
      opacity: 0
    }
  },
  compactRoundedButton: {
    display: 'flex',
    background: COLORS.whiteWithStrongTransparency,
    alignItems: 'center',
    gap: theme.spacing(1),
    border: `1px solid ${COLORS.whiteWithTransparency}`,
    padding: '2px 6px',
    borderRadius: 12,
    cursor: 'pointer',
    color: theme.palette.grey[300],
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    '&:hover': {
      filter: 'brightness(1.2)'
    },
    '&:has([class*="successIcon"])': {
      background: 'transparent',
      borderColor: 'transparent'
    }
  }
}))
