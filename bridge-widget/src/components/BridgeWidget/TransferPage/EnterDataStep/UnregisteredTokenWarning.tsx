import { Typography } from '@mui/material'
import WarningBox from '../../WarningBox'
import { GRAY } from '../../styles'
import RegisterNowButton from './RegisterNowButton'
import useIsWalletReady from '../../../../hooks/useIsWalletReady'
import {
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetAssetWrapper,
  selectTransferTargetChain
} from '../../../../store/selectors'
import { useSelector } from 'react-redux'
import { CHAINS_BY_ID } from '../../../../utils/consts'

const UnregisteredTokenWarning = () => {
  const targetChain = useSelector(selectTransferTargetChain)
  const { statusMessage } = useIsWalletReady(targetChain)
  const parsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)
  const { data } = useSelector(selectTransferTargetAssetWrapper)

  const shouldShow = !statusMessage && data && !data.doesExist

  if (!shouldShow) return null

  return (
    <WarningBox>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          width: '100%'
        }}
      >
        <div>
          <Typography style={{ fontWeight: 600 }}>
            {parsedTokenAccount?.symbol} is not registered on {CHAINS_BY_ID[targetChain].name}.
          </Typography>
          <Typography style={{ color: GRAY, fontSize: '14px' }}>Please register it now.</Typography>
        </div>

        <RegisterNowButton />
      </div>
    </WarningBox>
  )
}

export default UnregisteredTokenWarning
