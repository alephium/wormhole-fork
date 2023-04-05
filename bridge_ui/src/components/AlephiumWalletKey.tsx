import ToggleConnectedButton from "./ToggleConnectedButton";
import { AlephiumConnectButton, useConnect, useAlephiumConnectContext } from "@alephium/web3-react"

const AlephiumWalletKey = () => {
  const context = useAlephiumConnectContext()
  const { disconnect } = useConnect({
    chainGroup: context.addressGroup,
    keyType: context.keyType,
    networkId: context.network
  })

  return (
    <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
      {({ isConnected, show, address }) => {
        return (
          // `show` and `hide` will never be undefined. TODO: Fix the types in web3-react
          <ToggleConnectedButton connect={show!} disconnect={disconnect} connected={isConnected} pk={address ?? ''} />
        )
      }}
    </AlephiumConnectButton.Custom>
  )
};

export default AlephiumWalletKey;
