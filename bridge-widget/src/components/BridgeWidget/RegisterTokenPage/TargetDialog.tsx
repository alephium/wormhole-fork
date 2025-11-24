import { ChainId } from '@alephium/wormhole-sdk'
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import useIsWalletReady from '../../../hooks/useIsWalletReady'
import { setTargetChain } from '../../../store/attestSlice'
import { selectAttestTargetChain } from '../../../store/selectors'
import BridgeWidgetButton from '../BridgeWidgetButton'
import Target from './Target'

interface TargetDialogProps {
  open: boolean
  title: string
  onClose: () => void
}

const TargetDialog = ({ open, title, onClose }: TargetDialogProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const storeTargetChain = useSelector(selectAttestTargetChain)
  const [draftTargetChain, setDraftTargetChain] = useState<ChainId>(storeTargetChain)
  const { isReady: isDraftTargetWalletReady } = useIsWalletReady(draftTargetChain, false)

  useEffect(() => {
    if (!open) return
    setDraftTargetChain(storeTargetChain)
  }, [open, storeTargetChain])

  const handleDraftTargetChainChange = useCallback((chainId: ChainId) => {
    setDraftTargetChain(chainId)
  }, [])

  const canSave = !!draftTargetChain && isDraftTargetWalletReady

  const handleSave = useCallback(() => {
    if (!canSave) return

    if (draftTargetChain !== storeTargetChain) {
      dispatch(setTargetChain(draftTargetChain))
    }

    onClose()
  }, [canSave, dispatch, draftTargetChain, onClose, storeTargetChain])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Target
          showNextButton={false}
          targetChain={draftTargetChain}
          onTargetChainChange={handleDraftTargetChainChange}
        />
      </DialogContent>
      <DialogActions>
        <BridgeWidgetButton onClick={handleSave} disabled={!canSave}>
          {t('Save')}
        </BridgeWidgetButton>
      </DialogActions>
    </Dialog>
  )
}

export default TargetDialog
