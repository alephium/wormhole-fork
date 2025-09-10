import { useCallback, useState } from "react";
import EnterDataStep from "./EnterDataStep";
import ReviewStep from "./ReviewStep";
import TransferStep from "./TransferStep";

const BridgeWidgetSteps = () => {
  const [step, setStep] = useState(0);

  const handleNext = useCallback(() => setStep((prev) => prev + 1), []);
  const handleBack = useCallback(() => setStep((prev) => prev - 1), []);

  return step === 0 ? (
    <EnterDataStep onNext={handleNext} />
  ) : step === 1 ? (
    <ReviewStep onNext={handleNext} onBack={handleBack} />
  ) : (
    <TransferStep onBack={handleBack} />
  );
};

export default BridgeWidgetSteps;
