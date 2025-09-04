import { IconButton } from "@material-ui/core";
import { ArrowForward, SwapHoriz } from "@material-ui/icons";
import { useState } from "react";

export default function ChainSelectArrow2({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [showSwap, setShowSwap] = useState(false);

  return (
    <IconButton
      style={{
        color: "rgba(255, 255, 255, 0.5)",
        borderColor: "rgb(20, 19, 21)",
        borderWidth: "2px",
        borderStyle: "solid",
        backgroundColor: "rgb(30 30 31)",
      }}
      onClick={onClick}
      onMouseEnter={() => {
        setShowSwap(true);
      }}
      onMouseLeave={() => {
        setShowSwap(false);
      }}
      disabled={disabled}
    >
      {showSwap ? <SwapHoriz /> : <ArrowForward />}
    </IconButton>
  );
}
