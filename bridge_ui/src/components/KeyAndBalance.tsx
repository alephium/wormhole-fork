import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import AlephiumWalletKey from "./AlephiumWalletKey";
import EthereumSignerKey from "./EthereumSignerKey";
import SolanaWalletKey from "./SolanaWalletKey";
import TerraWalletKey from "./TerraWalletKey";

function KeyAndBalance({ chainId }: { chainId: ChainId }) {
  if (isEVMChain(chainId)) {
    return (
      <>
        <EthereumSignerKey />
      </>
    );
  }
  if (chainId === CHAIN_ID_SOLANA) {
    return (
      <>
        <SolanaWalletKey />
      </>
    );
  }
  if (chainId === CHAIN_ID_TERRA) {
    return (
      <>
        <TerraWalletKey />
      </>
    );
  }
  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <>
        <AlephiumWalletKey />
      </>
    )
  }
  return null;
}

export default KeyAndBalance;
