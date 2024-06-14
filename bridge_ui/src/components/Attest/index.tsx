import {
  Container,
  makeStyles,
  Step,
  StepButton,
  StepContent,
  Stepper,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { setStep } from "../../store/attestSlice";
import {
  selectAttestActiveStep,
  selectAttestIsCreateComplete,
  selectAttestIsCreating,
  selectAttestIsSendComplete,
  selectAttestIsSending,
} from "../../store/selectors";
import HeaderText from "../HeaderText";
import Create from "./Create";
import CreatePreview from "./CreatePreview";
import Send from "./Send";
import SendPreview from "./SendPreview";
import Source from "./Source";
import SourcePreview from "./SourcePreview";
import Target from "./Target";
import TargetPreview from "./TargetPreview";

const useStyles = makeStyles((theme) => ({
  spacer: { height: theme.spacing(2) },
}));

function Attest() {
  const { t } = useTranslation()
  const classes = useStyles();
  const dispatch = useDispatch();
  const activeStep = useSelector(selectAttestActiveStep);
  const isSending = useSelector(selectAttestIsSending);
  const isSendComplete = useSelector(selectAttestIsSendComplete);
  const isCreating = useSelector(selectAttestIsCreating);
  const isCreateComplete = useSelector(selectAttestIsCreateComplete);
  const preventNavigation =
    (isSending || isSendComplete || isCreating) && !isCreateComplete;
  useEffect(() => {
    if (preventNavigation) {
      window.onbeforeunload = () => true;
      return () => {
        window.onbeforeunload = null;
      };
    }
  }, [preventNavigation]);
  return (
    <Container maxWidth="md">
      <HeaderText white>{t("Token Registration")}</HeaderText>
      <Alert severity="info">
        {t("This form allows you to register a token on a new foreign chain. Tokens must be registered before they can be transferred.")}
      </Alert>
      <div className={classes.spacer} />
      <Stepper activeStep={activeStep} orientation="vertical">
        <Step
          expanded={activeStep >= 0}
          disabled={preventNavigation || isCreateComplete}
        >
          <StepButton onClick={() => dispatch(setStep(0))} icon={null}>
            1. {t("Source")}
          </StepButton>
          <StepContent>
            {activeStep === 0 ? <Source /> : <SourcePreview />}
          </StepContent>
        </Step>
        <Step
          expanded={activeStep >= 1}
          disabled={preventNavigation || isCreateComplete}
        >
          <StepButton onClick={() => dispatch(setStep(1))} icon={null}>
            2. {t("Target")}
          </StepButton>
          <StepContent>
            {activeStep === 1 ? <Target /> : <TargetPreview />}
          </StepContent>
        </Step>
        <Step expanded={activeStep >= 2} disabled={isSendComplete}>
          <StepButton onClick={() => dispatch(setStep(2))} icon={null}>
            3. {t("Send attestation")}
          </StepButton>
          <StepContent>
            {activeStep === 2 ? <Send /> : <SendPreview />}
          </StepContent>
        </Step>
        <Step expanded={activeStep >= 3}>
          <StepButton
            onClick={() => dispatch(setStep(3))}
            disabled={!isSendComplete}
            icon={null}
          >
            4. {t("Create wrapped token")}
          </StepButton>
          <StepContent>
            {isCreateComplete ? <CreatePreview /> : <Create />}
          </StepContent>
        </Step>
      </Stepper>
    </Container>
  );
}

export default Attest;
