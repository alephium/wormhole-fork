import ToggleConnectedButton from "./ToggleConnectedButton";
import { AlephiumConnectButton } from "@alephium/web3-react"

const AlephiumWalletKey = () => {
  return (
    <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
      {({ isConnected, show, disconnect, account }) => {
        return (
          // `show` and `hide` will never be undefined. TODO: Fix the types in web3-react
          <ToggleConnectedButton connect={show!} disconnect={disconnect} connected={isConnected} pk={account?.address ?? ''} />
        )
      }}
    </AlephiumConnectButton.Custom>
  )
};

export default AlephiumWalletKey;
