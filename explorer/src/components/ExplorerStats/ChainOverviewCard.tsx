import { Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { chainIDStrings } from "../../utils/consts";
import { amountFormatter } from "../../utils/explorer";
import {
  NotionalTransferred,
  NotionalTransferredTo,
  Totals,
} from "./ExplorerStats";

interface ChainOverviewCardProps {
  dataKey: keyof typeof chainIDStrings;
  totals?: Totals;
  notionalTransferred?: NotionalTransferred;
  notionalTransferredTo?: NotionalTransferredTo;
}

const ChainOverviewCard: React.FC<ChainOverviewCardProps> = ({
  dataKey,
  totals,
  notionalTransferred,
  notionalTransferredTo,
}) => {
  const [totalCount, setTotalColunt] = useState<number>();
  const [animate, setAnimate] = useState<boolean>(false);

  useEffect(() => {
    // hold values from props in state, so that we can detect changes and add animation class
    setTotalColunt(totals?.TotalCount[dataKey]);

    let timeout: NodeJS.Timeout;
    if (
      totals?.TotalCount[dataKey] &&
      totalCount !== totals?.TotalCount[dataKey]
    ) {
      setAnimate(true);
      timeout = setTimeout(() => {
        setAnimate(false);
      }, 2000);
    }
    return function cleanup() {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [
    totals?.TotalCount[dataKey],
    dataKey,
    totalCount,
  ]);

  const centerStyles: any = {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    flexDirection: "column",
  };
  // prevent an exception if data is missing (ie. new chain)
  if (
    !notionalTransferredTo ||
    !(dataKey in notionalTransferredTo.WithinPeriod) ||
    !("*" in notionalTransferredTo.WithinPeriod[dataKey])
  ) {
    return <>coming soon</>
  }
  return (
    <>
      <div style={{ ...centerStyles, gap: 8 }}>
        {notionalTransferredTo &&
          notionalTransferredTo.WithinPeriod && (
            <div style={centerStyles}>
              <div>
                <Typography
                  variant="h5"
                  className={animate ? "highlight-new-val" : ""}
                >
                  $
                  {amountFormatter(
                    notionalTransferredTo.WithinPeriod[dataKey]["*"]
                  )}
                </Typography>
              </div>
              <div style={{ marginTop: -10 }}>
                <Typography variant="caption">received</Typography>
              </div>
            </div>
          )}
        {notionalTransferred &&
          notionalTransferred.WithinPeriod &&
          dataKey in notionalTransferred.WithinPeriod &&
          "*" in notionalTransferred.WithinPeriod[dataKey] &&
          "*" in notionalTransferred.WithinPeriod[dataKey]["*"] &&
          notionalTransferred.WithinPeriod[dataKey]["*"]["*"] > 0 ? (
          <div style={centerStyles}>
            <div>
              <Typography
                variant="h5"
                className={animate ? "highlight-new-val" : ""}
              >
                {notionalTransferred.WithinPeriod[dataKey]["*"]["*"]
                  ? "$" +
                  amountFormatter(
                    notionalTransferred.WithinPeriod[dataKey]["*"]["*"]
                  )
                  : "..."}
              </Typography>
            </div>
            <div style={{ marginTop: -10 }}>
              <Typography variant="caption">sent</Typography>
            </div>
          </div>
        ) : (
          <div style={centerStyles}>
            <div>
              <Typography variant="h5">
                <span style={{ fontSize: "75%", verticalAlign: 'middle' }}>Coming Soon</span>
              </Typography>
            </div>
            <div style={{ marginTop: -10 }}>
              <Typography variant="caption">sent</Typography>
            </div>
          </div>
        )}
        {!!totalCount && (
          <div style={centerStyles}>
            <div>
              <Typography
                variant="h5"
                className={animate ? "highlight-new-val" : ""}
              >
                {amountFormatter(totalCount)}
              </Typography>
            </div>
            <div style={{ marginTop: -10 }}>
              <Typography variant="caption"> messages </Typography>
            </div>
          </div>
        )}
      </div>

      {totalCount === 0 && <Typography variant="h6">coming soon</Typography>}
    </>
  );
};

export default ChainOverviewCard;
