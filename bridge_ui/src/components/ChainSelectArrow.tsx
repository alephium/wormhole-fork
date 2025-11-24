import { IconButton } from "@mui/material";
import { ArrowForward, SwapHoriz } from "@mui/icons-material";
import { useState } from "react";

export default function ChainSelectArrow({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [showSwap, setShowSwap] = useState(false);

  return (
    <IconButton
      style={{ color: "rgba(255, 255, 255, 0.5)" }}
      onClick={onClick}
      onMouseEnter={() => {
        setShowSwap(true);
      }}
      onMouseLeave={() => {
        setShowSwap(false);
      }}
      disabled={disabled}
      size="large">
      {showSwap ? <SwapHoriz /> : <ArrowForward />}
    </IconButton>
  );
}
