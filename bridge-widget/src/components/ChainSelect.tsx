import { ListItemIcon, ListItemText, MenuItem, OutlinedTextFieldProps, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import clsx from 'clsx'
import { useMemo } from 'react'
import { ChainInfo, getConst } from '../utils/consts'

const useStyles = makeStyles()(() => ({
  select: {
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center'
    }
  },
  listItemIcon: {
    minWidth: 40
  },
  icon: {
    height: 24,
    maxWidth: 24
  }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createChainMenuItem = ({ id, name, logo }: ChainInfo, classes: any) => (
  <MenuItem key={id} value={id}>
    <ListItemIcon className={classes.listItemIcon}>
      <img src={logo} alt={name} className={classes.icon} />
    </ListItemIcon>
    <ListItemText>{name}</ListItemText>
  </MenuItem>
)

interface ChainSelectProps extends OutlinedTextFieldProps {
  chains: ChainInfo[]
}

export default function ChainSelect({ chains, ...rest }: ChainSelectProps) {
  const { classes } = useStyles()
  const filteredChains = useMemo(() => chains.filter(({ id }) => !getConst('BETA_CHAINS').includes(id)), [chains])
  return (
    <TextField {...rest} className={clsx(classes.select, rest.className)}>
      {filteredChains.map((chain) => createChainMenuItem(chain, classes))}
    </TextField>
  )
}
