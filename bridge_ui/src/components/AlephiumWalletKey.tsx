import { ALEPHIUM_BRIDGE_GROUP_INDEX, CLUSTER } from "../utils/consts";
import ToggleConnectedButton from "./ToggleConnectedButton";
import { AlephiumConnectButton, useConnect } from "@alephium/web3-react"

const AlephiumWalletKey = () => {
  const { disconnect } = useConnect({
    addressGroup: ALEPHIUM_BRIDGE_GROUP_INDEX,
    networkId: CLUSTER
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
