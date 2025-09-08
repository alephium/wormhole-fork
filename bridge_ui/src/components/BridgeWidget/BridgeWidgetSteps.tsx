import { useCallback, useState } from "react";
import EnterDataStep from "./EnterDataStep";
import ReviewStep from "./ReviewStep";

const BridgeWidgetSteps = () => {
  const [step, setStep] = useState(0);

  const handleNext = useCallback(() => setStep(1), []);
  const handleBack = useCallback(() => setStep(0), []);

  return step === 0 ? <EnterDataStep onNext={handleNext} /> : <ReviewStep onBack={handleBack} />;
};

export default BridgeWidgetSteps;
