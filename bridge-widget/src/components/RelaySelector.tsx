import { CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ChangeEvent, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useRelayersAvailable, { Relayer } from '../hooks/useRelayersAvailable'

const useStyles = makeStyles()(() => ({
  mainContainer: {
    textAlign: 'center'
  }
}))

export default function RelaySelector({
  selectedValue,
  onChange
}: {
  selectedValue: Relayer | null
  onChange: (newValue: Relayer | null) => void
}) {
  const { t } = useTranslation()
  const { classes } = useStyles()
  const availableRelayers = useRelayersAvailable(true)

  const loader = (
    <div>
      <CircularProgress></CircularProgress>
      <Typography>{t('Loading available relayers')}</Typography>
    </div>
  )

  const onChangeWrapper = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      console.log(event, 'event in selector')
      if (event.target.value) {
        onChange(availableRelayers?.data?.relayers?.find((x) => x.url === event.target.value) || null)
      } else {
        onChange(null)
      }
    },
    [onChange, availableRelayers]
  )

  console.log('selectedValue in relay selector', selectedValue)

  const selector = (
    <TextField onChange={onChangeWrapper} value={selectedValue ? selectedValue.url : ''} label={t('Select a relayer')} select fullWidth>
      {availableRelayers.data?.relayers?.map((item) => (
        <MenuItem key={item.url} value={item.url}>
          {item.name}
        </MenuItem>
      ))}
    </TextField>
  )

  const error = (
    <Typography variant="body2" color="textSecondary">
      {t('No relayers are available at this time.')}
    </Typography>
  )

  return (
    <div className={classes.mainContainer}>
      {availableRelayers.data?.relayers?.length ? selector : availableRelayers.isFetching ? loader : error}
    </div>
  )
}
