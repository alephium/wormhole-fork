import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  isEVMChain,
} from "@alephium/wormhole-sdk";
import AlephiumWalletKey from "./AlephiumWalletKey";
import AlgorandWalletKey from "./AlgorandWalletKey";
import EthereumSignerKey from "./EthereumSignerKey";
import SolanaWalletKey from "./SolanaWalletKey";

function KeyAndBalance({ chainId }: { chainId: ChainId }) {
  if (isEVMChain(chainId)) {
    return <EthereumSignerKey chainId={chainId} />;
  }
  if (chainId === CHAIN_ID_SOLANA) {
    return <SolanaWalletKey />;
  }
  if (chainId === CHAIN_ID_ALGORAND) {
    return <AlgorandWalletKey />;
  }
  if (chainId === CHAIN_ID_ALEPHIUM) {
    return <AlephiumWalletKey />
  }
  return null;
}

export default KeyAndBalance;
