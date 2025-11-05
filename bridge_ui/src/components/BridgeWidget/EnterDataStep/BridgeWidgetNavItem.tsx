import { SvgIconTypeMap, Tooltip } from '@material-ui/core'
import { useWidgetStyles } from '../styles'
import { OverridableComponent } from '@material-ui/core/OverridableComponent'

interface BridgeWidgetNavItemProps {
  tooltipDisabledTitle: string
  disabled: boolean
  onClick: () => void
  Icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>
  title: string
}

const BridgeWidgetNavItem = ({ tooltipDisabledTitle, disabled, onClick, Icon, title }: BridgeWidgetNavItemProps) => {
  const widgetClasses = useWidgetStyles()

  return (
    <Tooltip title={disabled ? tooltipDisabledTitle : ''} disableHoverListener={!disabled}>
      <span style={{ display: 'inline-flex' }}>
        <button className={widgetClasses.discreetButton} onClick={onClick} disabled={disabled}>
          <Icon style={{ fontSize: '16px' }} />
          {title}
        </button>
      </span>
    </Tooltip>
  )
}

export default BridgeWidgetNavItem
