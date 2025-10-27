import { ReactNode } from "react"
import { makeStyles } from "@material-ui/core"
import { COLORS } from "../../muiTheme"

interface DividerProps {
  children?: ReactNode
  className?: string
}

const Divider = ({ children, className }: DividerProps) => {
  const classes = useStyles()

  return (
    <div className={className ?? classes.root}>
      <div className={classes.line} />
      {children}
    </div>
  )
}

export default Divider

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    width: "100%",
    height: 1,
  },
  line: {
    position: "absolute",
    inset: 0,
    backgroundColor: COLORS.whiteWithTransparency,
    borderRadius: theme.shape.borderRadius,
  },
}))
