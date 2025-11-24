import {
  Container,
  Divider,
  Typography
} from "@mui/material"
import { makeStyles } from 'tss-react/mui';
import { Alert } from "@mui/material"
import clsx from "clsx"
import { Fragment, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useWidgetStyles } from "../BridgeWidget/styles"
import { COLORS } from "../../muiTheme"
import { AttestStepId, useAttestSteps } from "./useAttestSteps"
import SourceDialog from "./SourceDialog"
import TargetDialog from "./TargetDialog"
import AttestStep from "./AttestStep"
import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton"
import { useHistory } from "react-router-dom"

const Attest = () => {
  const { t } = useTranslation()
  const { classes: widgetClasses } = useWidgetStyles()
  const {
    steps,
    derivedActiveStep,
    preventNavigation,
    canEditStep
  } = useAttestSteps()
  const [editDialogStep, setEditDialogStep] = useState<AttestStepId | null>(null)
  const { classes } = useStyles()
  const selectLabel = t("Select")
  const { push } = useHistory();

  useEffect(() => {
    window.onbeforeunload = preventNavigation ? () => true : null

    return () => {
      window.onbeforeunload = null
    }
  }, [preventNavigation])

  const handleOpenDialog = useCallback(
    (stepId: AttestStepId) => {
      if (!canEditStep(stepId)) return
      setEditDialogStep(stepId)
    },
    [canEditStep]
  )

  const handleCloseDialog = () => setEditDialogStep(null)

  const sourceStep = steps.find((step) => step.id === 0)
  const targetStep = steps.find((step) => step.id === 1)
  const isCompleted = steps.every((step) => step.status === "complete")

  return (
    <Container maxWidth="sm" className={classes.pageContainer}>
      <Typography variant='h1' style={{ margin: 0 }}>{t("Token Registration")}</Typography>
      <Alert severity="info">
        {t("This form allows you to register a token on a new foreign chain. Tokens must be registered before they can be transferred.")}
      </Alert>
      <div className={clsx(widgetClasses.grayRoundedBox, classes.stepsWrapper)}>
        <div className={classes.stepsContainer}>
          {steps.map((step, index) => (
            <Fragment key={step.id}>
              <AttestStep
                step={step}
                derivedActiveStep={derivedActiveStep}
                canEditStep={canEditStep}
                onOpenDialog={handleOpenDialog}
                selectLabel={selectLabel}
              />
              {index < steps.length - 1 && <Divider className={classes.stepDivider} />}
            </Fragment>
          ))}
        </div>
      </div>

      {isCompleted && (
        <BridgeWidgetButton onClick={() => push("/")}>Back to the homepage</BridgeWidgetButton>
      )}

      {sourceStep && (
        <SourceDialog
          open={editDialogStep === 0}
          title={sourceStep.title}
          onClose={handleCloseDialog}
        />
      )}
      {targetStep && (
        <TargetDialog
          open={editDialogStep === 1}
          title={targetStep.title}
          onClose={handleCloseDialog}
        />
      )}
    </Container>
  )
}

export default Attest

const useStyles = makeStyles()((theme) => ({
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      gap: theme.spacing(1.5),
      paddingBottom: theme.spacing(3),
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(1.5)
    }
  },
  stepsWrapper: {
    padding: theme.spacing(2.5),
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    width: '100%',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2)
    }
  },
  stepsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  stepDivider: {
    backgroundColor: COLORS.whiteWithTransparency,
  }
}))
