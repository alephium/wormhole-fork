import { useWidgetStyles, YELLOW_BG } from './styles'

const WarningBox = ({ children }: { children: React.ReactNode }) => {
  const classes = useWidgetStyles()

  return (
    <div
      className={classes.grayRoundedBox}
      style={{ backgroundColor: YELLOW_BG, display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      {children}
    </div>
  )
}

export default WarningBox
