import {
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
  makeStyles
} from "@material-ui/core"
import { Alert } from "@material-ui/lab"
import { RadioButtonUncheckedRounded, CheckCircleOutlineRounded } from "@material-ui/icons"
import clsx from "clsx"
import { Fragment, KeyboardEvent, MouseEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { ChainId } from "@alephium/wormhole-sdk"
import { useTranslation } from "react-i18next"
import { useDispatch, useSelector } from "react-redux"
import {
  selectAttestActiveStep,
  selectAttestIsCreateComplete,
  selectAttestIsCreating,
  selectAttestIsSendComplete,
  selectAttestIsSending,
  selectAttestIsSourceComplete,
  selectAttestIsTargetComplete,
  selectAttestIsWalletApproved,
  selectAttestAttestTx,
  selectAttestCreateTx,
  selectAttestSourceAsset,
  selectAttestSourceChain,
  selectAttestTargetChain
} from "../../store/selectors"
import { CHAINS_BY_ID } from "../../utils/consts"
import { useWidgetStyles } from "../BridgeWidget/styles"
import Source from "./Source"
import Target from "./Target"
import SmartAddress from "../SmartAddress"
import { GRAY, GREEN } from "../BridgeWidget/styles"
import { COLORS } from "../../muiTheme"
import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton"
import ShowTx from "../ShowTx"
import Send from "./Send"
import SendPreview from "./SendPreview"
import Create from "./Create"
import CreatePreview from "./CreatePreview"
import { setStep, setSourceChain, setSourceAsset, setTargetChain } from "../../store/attestSlice"
import useIsWalletReady from "../../hooks/useIsWalletReady"
import KeyAndBalance from "../KeyAndBalance"

type AttestStepId = 0 | 1 | 2 | 3

type StepStatus = "pending" | "active" | "inProgress" | "complete"

interface StepDefinition {
  id: AttestStepId
  title: string
  description: string
  value?: ReactNode
  subLabel?: string
  isEditable?: boolean
  status: StepStatus
  disabled: boolean
  renderRawValue?: boolean
}

function Attest() {
  const { t } = useTranslation()
  const widgetClasses = useWidgetStyles()
  const dispatch = useDispatch()
  const activeStep = useSelector(selectAttestActiveStep)
  const isSending = useSelector(selectAttestIsSending)
  const isSendComplete = useSelector(selectAttestIsSendComplete)
  const isCreating = useSelector(selectAttestIsCreating)
  const isCreateComplete = useSelector(selectAttestIsCreateComplete)
  const isSourceComplete = useSelector(selectAttestIsSourceComplete)
  const isTargetComplete = useSelector(selectAttestIsTargetComplete)
  const isWalletApproved = useSelector(selectAttestIsWalletApproved)
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)
  const targetChain = useSelector(selectAttestTargetChain)
  const attestTx = useSelector(selectAttestAttestTx)
  const createTx = useSelector(selectAttestCreateTx)
  const [editDialogStep, setEditDialogStep] = useState<AttestStepId | null>(null)
  const [draftSourceChain, setDraftSourceChain] = useState(sourceChain)
  const [draftSourceAsset, setDraftSourceAsset] = useState(sourceAsset)
  const [draftTargetChain, setDraftTargetChain] = useState(targetChain)
  const classes = useStyles()
  const { isReady: isTargetWalletReady } = useIsWalletReady(targetChain)
  const { isReady: isDraftSourceWalletReady } = useIsWalletReady(draftSourceChain, false)
  const { isReady: isDraftTargetWalletReady } = useIsWalletReady(draftTargetChain, false)
  const isTargetStepComplete = isTargetComplete && isTargetWalletReady

  const derivedActiveStep = useMemo<AttestStepId>(() => {
    if (!isSourceComplete) return 0
    if (!isTargetStepComplete) return 1
    if (!isSendComplete) return 2
    return 3
  }, [isSourceComplete, isTargetStepComplete, isSendComplete])

  const preventNavigation =
    (isSending || isSendComplete || isCreating) && !isCreateComplete
  useEffect(() => {
    if (preventNavigation) {
      window.onbeforeunload = () => true
      return () => {
        window.onbeforeunload = null
      }
    }
  }, [preventNavigation])

  useEffect(() => {
    if (activeStep !== derivedActiveStep) {
      dispatch(setStep(derivedActiveStep))
    }
  }, [activeStep, derivedActiveStep, dispatch])

  useEffect(() => {
    if (editDialogStep === 0) {
      setDraftSourceChain(sourceChain)
      setDraftSourceAsset(sourceAsset)
    } else if (editDialogStep === 1) {
      setDraftTargetChain(targetChain)
    }
  }, [editDialogStep, sourceChain, sourceAsset, targetChain])

  const renderStatusIcon = useCallback((status: StepStatus) => {
    if (status === "complete") return <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
    if (status === "inProgress") return <CircularProgress size={18} style={{ color: COLORS.white }} />
    return (
      <RadioButtonUncheckedRounded
        fontSize="small"
        style={{ color: COLORS.white }}
      />
    )
  }, [])

  const sourceDescription = t("Source chain and token to attest")
  const targetDescription = t("Chain where the wrapped token will live")
  const sendDescription = t("Attestation transaction details")
  const createDescription = t("Wrapped token creation details")

  const sourceValue = isSourceComplete && sourceAsset
    ? <SmartAddress chainId={sourceChain} address={sourceAsset} isAsset />
    : undefined
  const sourceSubLabel = isSourceComplete
    ? t("Will be attested on {{ chainName }}", {
        chainName: CHAINS_BY_ID[sourceChain]?.name ?? t("Unknown chain")
      })
    : undefined

  const hasTargetChainInfo = Boolean(CHAINS_BY_ID[targetChain])
  const shouldShowTargetConnectButton =
    isSourceComplete && hasTargetChainInfo && !isTargetWalletReady
  const targetValue = isTargetStepComplete
    ? <span>{CHAINS_BY_ID[targetChain]?.name ?? t("Unknown chain")}</span>
    : shouldShowTargetConnectButton
      ? (
        <KeyAndBalance chainId={targetChain} />
      )
      : undefined

  const sendValue = attestTx
    ? <ShowTx chainId={sourceChain} tx={attestTx} />
    : undefined
  const sendSubLabel = attestTx ? t("Transaction hash") : undefined

  const createValue = createTx
    ? <ShowTx chainId={targetChain} tx={createTx} />
    : undefined
  const createSubLabel = createTx ? t("Wrapped token transaction") : undefined

  const canEditStep = (stepId: AttestStepId) => stepId === 0 || stepId === 1

  const getStatus = (id: AttestStepId): StepStatus => {
    if (id === 0) return isSourceComplete ? "complete" : derivedActiveStep === 0 ? "active" : "pending"
    if (id === 1) return isTargetStepComplete ? "complete" : derivedActiveStep === 1 ? "active" : "pending"
    if (id === 2) {
      if (isSendComplete) return "complete"
      if (isSending || isWalletApproved) return "inProgress"
      return derivedActiveStep === 2 ? "active" : "pending"
    }
    if (isCreateComplete) return "complete"
    if (isCreating) return "inProgress"
    return derivedActiveStep === 3 ? "active" : "pending"
  }

  const steps: StepDefinition[] = [
    {
      id: 0,
      title: t("Source"),
      description: sourceDescription,
      value: sourceValue,
      subLabel: sourceSubLabel,
      isEditable: true,
      status: getStatus(0),
      disabled: preventNavigation || isCreateComplete
    },
    {
      id: 1,
      title: t("Target"),
      description: targetDescription,
      value: targetValue,
      isEditable: true,
      status: getStatus(1),
      disabled: preventNavigation || isCreateComplete,
      renderRawValue: shouldShowTargetConnectButton
    },
    {
      id: 2,
      title: t("Send attestation"),
      description: sendDescription,
      value: sendValue,
      subLabel: sendSubLabel,
      status: getStatus(2),
      disabled: isSendComplete,
    },
    {
      id: 3,
      title: t("Create wrapped token"),
      description: createDescription,
      value: createValue,
      subLabel: createSubLabel,
      status: getStatus(3),
      disabled: !isSendComplete,
    },
  ]

  const handleEditClick = useCallback(
    (event: MouseEvent<HTMLElement>, stepId: AttestStepId, disabled: boolean) => {
      event.stopPropagation()
      if (disabled || !canEditStep(stepId)) {
        return
      }
      setEditDialogStep(stepId)
    },
    []
  )

  const handleEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, stepId: AttestStepId, disabled: boolean) => {
      if (disabled || !canEditStep(stepId)) {
        return
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        setEditDialogStep(stepId)
      }
    },
    []
  )

  const shouldIgnoreStepInteraction = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false
    }
    return Boolean(target.closest('button'))
  }, [])

  const renderStepValue = (step: StepDefinition) => {
    const isEditable = step.isEditable ?? canEditStep(step.id)
    const hasValue = step.value !== undefined && step.value !== null
    const isStepDisabled = step.disabled || step.status === 'pending'
    const shouldShowSelect = isEditable && step.id === derivedActiveStep && !hasValue && !isStepDisabled

    if (step.renderRawValue) {
      return <>{step.value}</>
    }

    if (step.id === 2) {
      if (step.status === 'complete') {
        return sendValue ? (
          <div className={classes.stepValueStatic}>
            <div>{sendValue}</div>
            {sendSubLabel && <div className={classes.stepSubLabel}>{sendSubLabel}</div>}
          </div>
        ) : <SendPreview />
      }
      if (step.status === 'inProgress' || step.status === 'active') {
        return <Send />
      }
    }

    if (step.id === 3) {
      if (step.status === 'complete') {
        return createValue ? (
          <div className={classes.stepValueStatic}>
            <div>{createValue}</div>
            {createSubLabel && <div className={classes.stepSubLabel}>{createSubLabel}</div>}
          </div>
        ) : <CreatePreview />
      }
      if (step.status === 'inProgress' || step.status === 'active') {
        return <Create />
      }
    }

    if (shouldShowSelect) {
      return (
        <div className={classes.selectButtonWrapper}>
          <BridgeWidgetButton
            onClick={() => setEditDialogStep(step.id)}
            className={classes.selectButton}
            short
          >
            {t("Select")}
          </BridgeWidgetButton>
        </div>
      )
    }

    if (isEditable) {
      const isDisabled = isStepDisabled
      if (!hasValue) {
        if (step.status === 'pending') {
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
          tabIndex={isDisabled ? -1 : 0}
          className={clsx(
            classes.stepValue,
            !isDisabled && classes.stepValueInteractive,
            isDisabled && classes.stepValueDisabled
          )}
          onClick={(event) => {
            if (shouldIgnoreStepInteraction(event.target)) {
              return
            }
            handleEditClick(event, step.id, isDisabled)
          }}
          onKeyDown={(event) => {
            if (shouldIgnoreStepInteraction(event.target)) {
              return
            }
            handleEditKeyDown(event, step.id, isDisabled)
          }}
          aria-disabled={isDisabled}
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
        <div>{hasValue ? step.value : '—'}</div>
        {hasValue && step.subLabel && <div className={classes.stepSubLabel}>{step.subLabel}</div>}
      </div>
    )
  }

  const dialogStepDefinition = steps.find((step) => step.id === editDialogStep)

  const handleDraftSourceChainChange = useCallback((chainId: ChainId) => {
    setDraftSourceChain(chainId)
    setDraftSourceAsset("")
  }, [])

  const handleDraftSourceAssetChange = useCallback((asset: string) => {
    setDraftSourceAsset(asset)
  }, [])

  const handleDraftTargetChainChange = useCallback((chainId: ChainId) => {
    setDraftTargetChain(chainId)
  }, [])

  const renderDialogContent = () => {
    if (editDialogStep === 0) {
      return (
        <Source
          showNextButton={false}
          sourceChain={draftSourceChain}
          sourceAsset={draftSourceAsset}
          onSourceChainChange={handleDraftSourceChainChange}
          onSourceAssetChange={handleDraftSourceAssetChange}
        />
      )
    }
    if (editDialogStep === 1) {
      return (
        <Target
          showNextButton={false}
          targetChain={draftTargetChain}
          onTargetChainChange={handleDraftTargetChainChange}
        />
      )
    }
    return null
  }

  const dialogCanSave = editDialogStep === 0
    ? Boolean(draftSourceChain) && draftSourceAsset.trim().length > 0 && isDraftSourceWalletReady
    : editDialogStep === 1
      ? Boolean(draftTargetChain) && isDraftTargetWalletReady
      : true

  const handleCloseDialog = () => setEditDialogStep(null)

  const handleSaveDialog = () => {
    if (!dialogCanSave || editDialogStep === null) return

    if (editDialogStep === 0) {
      if (draftSourceChain !== sourceChain) {
        dispatch(setSourceChain(draftSourceChain))
      }
      if (draftSourceAsset !== sourceAsset) {
        dispatch(setSourceAsset(draftSourceAsset))
      }
    } else if (editDialogStep === 1) {
      if (draftTargetChain !== targetChain) {
        dispatch(setTargetChain(draftTargetChain))
      }
    }

    setEditDialogStep(null)
  }

  return (
    <Container maxWidth="sm" className={classes.pageContainer}>
      <Typography variant='h1' style={{ margin: 0 }}>Token registration</Typography>
      <Alert severity="info">
        {t("This form allows you to register a token on a new foreign chain. Tokens must be registered before they can be transferred.")}
      </Alert>
      <div className={clsx(widgetClasses.grayRoundedBox, classes.stepsWrapper)}>
        <div className={classes.stepsContainer}>
        {steps.map((step, index) => {
          const isRowDisabled = step.status === 'pending'
          return (
            <Fragment key={step.id}>
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
                <div className={classes.stepValueWrapper}>{renderStepValue(step)}</div>
              </div>
              {index < steps.length - 1 && <Divider className={classes.stepDivider} />}
            </Fragment>
          )})}
      </div>
      </div>

      <Dialog
        open={editDialogStep !== null}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{dialogStepDefinition?.title}</DialogTitle>
        <DialogContent>{renderDialogContent()}</DialogContent>
        <DialogActions>
          <BridgeWidgetButton
            onClick={handleSaveDialog}
            disabled={!dialogCanSave}
          >
            {t("Save")}
          </BridgeWidgetButton>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default Attest

const useStyles = makeStyles((theme) => ({
  pageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(4)
  },
  spacer: { height: theme.spacing(2) },
  stepsWrapper: {
    padding: theme.spacing(2.5),
    borderRadius: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5)
  },
  stepsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    cursor: "default",
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
  stepTitle: {
    color: COLORS.white,
    minWidth: 140,
  },
  stepMainColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  stepDescription: {
    flex: 1,
    color: GRAY,
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '1.2',
    maxWidth: '65%',
  },
  stepValueWrapper: {
    display: "flex",
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
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
    borderRadius: '12px',
    border: "1px solid transparent",
    textAlign: "right",
    alignSelf: "flex-end",
    transition: "border-color 0.2s ease, background-color 0.2s ease",
  },
  stepValueStatic: {
    padding: theme.spacing(1, 0),
    backgroundColor: 'transparent'
  },
  stepValuePlaceholder: {
    color: GRAY,
    fontStyle: "italic",
  },
  stepSubLabel: {
    width: "100%",
    textAlign: "right",
    color: GRAY,
    fontSize: '14px',
    fontWeight: 400,
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
  },
  selectButton: {
    width: "100%",
  },
  stepDivider: {
    backgroundColor: COLORS.whiteWithTransparency,
  }
}))
