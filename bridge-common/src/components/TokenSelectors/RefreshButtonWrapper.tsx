import {
  IconButton,
  Tooltip,
} from "@mui/material";
import { makeStyles } from 'tss-react/mui';
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";

import type { JSX } from "react";

const useStyles = makeStyles()(() => ({
    inlineContentWrapper: {
      display: "inline-block",
      flexGrow: 1,
    },
    flexWrapper: {
      "& > *": {
        margin: ".5rem",
      },
      display: "flex",
      alignItems: "center",
    },
  })
);

export default function RefreshButtonWrapper({
  children,
  callback,
}: {
  children: JSX.Element;
  callback: () => any;
}) {
  const { t } = useTranslation();
  const { classes } = useStyles();

  const refreshWrapper = (
    <div className={classes.flexWrapper}>
      <div className={classes.inlineContentWrapper}>{children}</div>
      <Tooltip title={t("Reload Tokens")}>
        <IconButton onClick={callback} size="large">
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </div>
  );

  return refreshWrapper;
}
