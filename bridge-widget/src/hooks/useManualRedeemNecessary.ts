import { useSelector } from 'react-redux'
import {
  selectTransferIsRedeemComplete,
  selectTransferRedeemTx,
  selectTransferIsRedeemedViaRelayer,
  selectTransferTargetChain
} from '../store/selectors'
import { useEffect, useState } from 'react'
import useTransferSignedVAA from './useTransferSignedVAA'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'

const useManualRedeemNecessary = () => {
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)
  const redeemTx = useSelector(selectTransferRedeemTx)
  const signedVAA = useTransferSignedVAA()
  const targetChain = useSelector(selectTransferTargetChain)

  const isRedeemed = isRedeemComplete || isRedeemedViaRelayer || redeemTx

  const [relayerIsUnresponsive, setRelayerIsUnresponsive] = useState(false)

  useEffect(() => {
    if (signedVAA && targetChain === CHAIN_ID_ALEPHIUM) {
      setTimeout(() => setRelayerIsUnresponsive(true), 10000)
    }
  }, [signedVAA, targetChain])

  const manualRedeemToAlephiumRequired = !isRedeemed && targetChain === CHAIN_ID_ALEPHIUM && relayerIsUnresponsive
  const manualRedeemToEvmRequired = !isRedeemed && targetChain !== CHAIN_ID_ALEPHIUM && signedVAA

  return {
    manualRedeemToAlephiumRequired,
    manualRedeemToEvmRequired
  }
}

export default useManualRedeemNecessary
