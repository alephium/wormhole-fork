import { Alert } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import pushToClipboard from '../utils/pushToClipboard'

export default function useCopyToClipboard(content: string) {
  const { t } = useTranslation()
  const { enqueueSnackbar } = useSnackbar()
  return useCallback(() => {
    pushToClipboard(content)?.then(() => {
      enqueueSnackbar(null, {
        content: <Alert severity="success">{t('Copied')}.</Alert>
      })
    })
  }, [content, enqueueSnackbar, t])
}
