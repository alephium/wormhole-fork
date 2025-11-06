import { KeyboardEvent, MouseEvent, useCallback } from "react"
import clsx from "clsx"
import { CircularProgress, Typography, makeStyles } from "@mui/material"
import { RadioButtonUncheckedRounded, CheckCircleOutlineRounded } from "@mui/icons-material"

import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton"
import { GREEN, GRAY } from "../BridgeWidget/styles"
import { COLORS } from "../../muiTheme"
import Send from "./Send"
import SendPreview from "./SendPreview"
import Create from "./Create"
import CreatePreview from "./CreatePreview"
import {
  AttestStepId,
  StepDefinition,
  StepStatus
} from "./useAttestSteps"

interface AttestStepProps {
  step: StepDefinition
  derivedActiveStep: AttestStepId
  canEditStep: (stepId: AttestStepId) => boolean
  onOpenDialog: (stepId: AttestStepId) => void
  selectLabel: string
}

const renderStatusIcon = (status: StepStatus) => {
  if (status === "complete") {
    return <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
  }
  if (status === "inProgress") {
    return <CircularProgress size={18} style={{ color: COLORS.white }} />
  }
  return (
    <RadioButtonUncheckedRounded
      fontSize="small"
      style={{ color: COLORS.white }}
    />
  )
}

const AttestStep = ({
  step,
  derivedActiveStep,
  canEditStep,
  onOpenDialog,
  selectLabel
}: AttestStepProps) => {
  const classes = useStyles()
  const isEditable = step.isEditable ?? canEditStep(step.id)
  const hasValue = step.value !== undefined && step.value !== null
  const isStepDisabled = step.disabled || step.status === "pending"
  const shouldShowSelect =
    isEditable &&
    step.id === derivedActiveStep &&
    !hasValue &&
    !isStepDisabled
  const isRowDisabled = step.status === "pending"

  const handleValueClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (isStepDisabled || !isEditable) return
      event.stopPropagation()
      onOpenDialog(step.id)
    },
    [isEditable, isStepDisabled, onOpenDialog, step.id]
  )

  const handleValueKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (isStepDisabled || !isEditable) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onOpenDialog(step.id)
      }
    },
    [isEditable, isStepDisabled, onOpenDialog, step.id]
  )

  const renderValue = () => {
    if (step.renderRawValue) {
      return step.value
    }

    if (step.id === 2) {
      if (step.status === "complete") {
        return step.value ? (
          <div className={classes.stepValueStatic}>
            <div style={{textAlign: 'right'}}>{step.value}</div>
            {step.subLabel && <div className={classes.stepSubLabel}>{step.subLabel}</div>}
          </div>
        ) : <SendPreview />
      }
      if (step.status === "inProgress" || step.status === "active") {
        return <Send />
      }
    }

    if (step.id === 3) {
      if (step.status === "complete") {
        return step.value ? (
          <div className={classes.stepValueStatic}>
            <div style={{textAlign: 'right'}}>{step.value}</div>
            {step.subLabel && <div className={classes.stepSubLabel}>{step.subLabel}</div>}
          </div>
        ) : <CreatePreview />
      }
      if (step.status === "inProgress" || step.status === "active") {
        return <Create />
      }
    }

    if (shouldShowSelect) {
      return (
        <div className={classes.selectButtonWrapper}>
          <BridgeWidgetButton
            short
            className={classes.selectButton}
            onClick={() => onOpenDialog(step.id)}
          >
            {selectLabel}
          </BridgeWidgetButton>
        </div>
      )
    }

    if (isEditable) {
      if (!hasValue) {
        if (step.status === "pending") {
          return (
            <div className={clsx(
              classes.stepValue,
              classes.stepValueStatic,
              classes.stepValuePlaceholder
            )}>
              —
            </div>
          )
        }
        return (
          <div className={clsx(classes.stepValue, classes.stepValuePlaceholder)}>
            —
          </div>
        )
      }
      return (
        <div
          role="button"
          tabIndex={isStepDisabled ? -1 : 0}
          className={clsx(
            classes.stepValue,
            !isStepDisabled && classes.stepValueInteractive,
            isStepDisabled && classes.stepValueDisabled
          )}
          onClick={handleValueClick}
          onKeyDown={handleValueKeyDown}
          aria-disabled={isStepDisabled}
        >
          <div>{step.value}</div>
          {step.subLabel && <div className={classes.stepSubLabel}>{step.subLabel}</div>}
        </div>
      )
    }

    return (
      <div
        className={clsx(
          classes.stepValue,
          classes.stepValueStatic,
          !hasValue && classes.stepValuePlaceholder
        )}
      >
        <div>{hasValue ? step.value : "—"}</div>
        {hasValue && step.subLabel && <div className={classes.stepSubLabel}>{step.subLabel}</div>}
      </div>
    )
  }

  return (
    <div
      className={clsx(
        classes.stepRow,
        step.status === "active" && classes.stepRowActive,
        isRowDisabled && classes.stepRowDisabled
      )}
    >
      <div className={classes.stepIcon}>{renderStatusIcon(step.status)}</div>
      <div className={classes.stepMainColumn}>
        <Typography className={classes.stepTitle}>
          {step.title}
        </Typography>
        <Typography className={classes.stepDescription}>{step.description}</Typography>
      </div>
      <div className={classes.stepValueWrapper}>{renderValue()}</div>
    </div>
  )
}

export default AttestStep

const useStyles = makeStyles((theme) => ({
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    cursor: "default",
    [theme.breakpoints.down('xs')]: {
      flexDirection: "column",
      alignItems: "stretch",
      gap: theme.spacing(1.5)
    }
  },
  stepRowActive: {
    opacity: 1,
  },
  stepRowDisabled: {
    opacity: 0.5,
  },
  stepIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
  },
  stepMainColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    [theme.breakpoints.down('xs')]: {
      width: "100%"
    }
  },
  stepTitle: {
    color: COLORS.white,
    minWidth: 140,
    [theme.breakpoints.down('xs')]: {
      minWidth: "auto"
    }
  },
  stepDescription: {
    flex: 1,
    color: GRAY,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: "1.2",
    maxWidth: "65%",
    [theme.breakpoints.down('xs')]: {
      maxWidth: "100%",
      marginTop: theme.spacing(0.5),
      textAlign: "left"
    }
  },
  stepValueWrapper: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    [theme.breakpoints.down('xs')]: {
      width: "100%",
      alignItems: "stretch"
    }
  },
  stepValue: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    fontWeight: 600,
    color: COLORS.nearWhite,
    padding: theme.spacing(1, 1.5),
    backgroundColor: COLORS.whiteWithStrongTransparency,
    borderRadius: "12px",
    border: "1px solid transparent",
    textAlign: "right",
    alignSelf: "flex-end",
    transition: "border-color 0.2s ease, background-color 0.2s ease",
    [theme.breakpoints.down('xs')]: {
      width: "100%",
      justifyContent: "flex-start",
      textAlign: "left",
      alignSelf: "stretch"
    }
  },
  stepValueStatic: {
    padding: theme.spacing(1, 0),
    backgroundColor: "transparent"
  },
  stepValuePlaceholder: {
    color: GRAY,
    fontStyle: "italic",
  },
  stepSubLabel: {
    width: "100%",
    textAlign: "right",
    color: GRAY,
    fontSize: "14px",
    fontWeight: 400,
    [theme.breakpoints.down('xs')]: {
      textAlign: "left"
    }
  },
  stepValueInteractive: {
    cursor: "pointer",
    '&:hover': {
      borderColor: COLORS.whiteWithTransparency,
      backgroundColor: COLORS.whiteWithStrongTransparency,
    },
    '&:focus-visible': {
      outline: `1px solid ${COLORS.whiteWithTransparency}`,
    },
  },
  stepValueDisabled: {
    cursor: "not-allowed",
    pointerEvents: "none",
    opacity: 0.6
  },
  selectButtonWrapper: {
    minWidth: 140,
    maxWidth: 160,
    [theme.breakpoints.down('xs')]: {
      width: "100%",
      minWidth: 0,
      maxWidth: "none"
    }
  },
  selectButton: {
    width: "100%",
  },
}))
