import { Typography } from "@mui/material";
import { makeStyles } from 'tss-react/mui';
import { ReactNode } from "react";

const useStyles = makeStyles()((theme) => ({
  description: {
    marginBottom: theme.spacing(4),
  },
}));

export default function StepDescription({
  children,
}: {
  children: ReactNode;
}) {
  const { classes } = useStyles();
  return (
    <Typography component="div" variant="body2" className={classes.description}>
      {children}
    </Typography>
  );
}
