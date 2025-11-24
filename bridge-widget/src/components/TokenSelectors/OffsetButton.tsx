import { Button } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ReactNode } from 'react'

const useStyles = makeStyles()(() => ({
  offsetButton: { display: 'block', marginLeft: 'auto', marginTop: 8 }
}))

export default function OffsetButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const { classes } = useStyles()
  return (
    <Button onClick={onClick} disabled={disabled} variant="outlined" className={classes.offsetButton}>
      {children}
    </Button>
  )
}
