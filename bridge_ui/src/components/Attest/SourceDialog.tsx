import { ChainId } from "@alephium/wormhole-sdk"
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@material-ui/core"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch, useSelector } from "react-redux"

import useIsWalletReady from "../../hooks/useIsWalletReady"
import { setSourceAsset, setSourceChain } from "../../store/attestSlice"
import { selectAttestSourceAsset, selectAttestSourceChain } from "../../store/selectors"
import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton"
import Source from "./Source"

interface SourceDialogProps {
  open: boolean
  title: string
  onClose: () => void
}

function SourceDialog({ open, title, onClose }: SourceDialogProps) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const storeSourceChain = useSelector(selectAttestSourceChain)
  const storeSourceAsset = useSelector(selectAttestSourceAsset)
  const [draftSourceChain, setDraftSourceChain] = useState<ChainId>(storeSourceChain)
  const [draftSourceAsset, setDraftSourceAsset] = useState(storeSourceAsset)
  const { isReady: isDraftSourceWalletReady } = useIsWalletReady(draftSourceChain, false)

  useEffect(() => {
    if (!open) {
      return
    }
    setDraftSourceChain(storeSourceChain)
    setDraftSourceAsset(storeSourceAsset)
  }, [open, storeSourceAsset, storeSourceChain])

  const handleDraftSourceChainChange = useCallback((chainId: ChainId) => {
    setDraftSourceChain(chainId)
    setDraftSourceAsset("")
  }, [])

  const handleDraftSourceAssetChange = useCallback((asset: string) => {
    setDraftSourceAsset(asset)
  }, [])

  const canSave =
    !!draftSourceChain &&
    draftSourceAsset.trim().length > 0 &&
    isDraftSourceWalletReady

  const handleSave = useCallback(() => {
    if (!canSave) {
      return
    }

    if (draftSourceChain !== storeSourceChain) {
      dispatch(setSourceChain(draftSourceChain))
    }

    if (draftSourceAsset !== storeSourceAsset) {
      dispatch(setSourceAsset(draftSourceAsset))
    }

    onClose()
  }, [canSave, dispatch, draftSourceAsset, draftSourceChain, onClose, storeSourceAsset, storeSourceChain])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Source
          showNextButton={false}
          sourceChain={draftSourceChain}
          sourceAsset={draftSourceAsset}
          onSourceChainChange={handleDraftSourceChainChange}
          onSourceAssetChange={handleDraftSourceAssetChange}
        />
      </DialogContent>
      <DialogActions>
        <BridgeWidgetButton onClick={handleSave} disabled={!canSave}>
          {t("Save")}
        </BridgeWidgetButton>
      </DialogActions>
    </Dialog>
  )
}

export default SourceDialog
