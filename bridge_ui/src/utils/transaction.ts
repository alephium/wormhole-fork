import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from "alephium-wormhole-sdk";
import { CLUSTER } from "./consts";

export function getTransactionLink(chainId: ChainId, txId: string): string | undefined {
  return chainId === CHAIN_ID_ETH
    ? `https://${CLUSTER === "testnet" ? "goerli." : ""}etherscan.io/tx/${txId}`
    : chainId === CHAIN_ID_BSC
    ? `https://${CLUSTER === "testnet" ? "testnet." : ""}bscscan.com/tx/${txId}`
    : chainId === CHAIN_ID_ALEPHIUM
    ? `https://explorer.${CLUSTER === 'testnet' ? 'testnet.' : ''}alephium.org/transactions/${txId}`
    : undefined;
}

export function shortenTxId(txId: string): string {
  return txId.length > 24
    ? `${txId.slice(0, 12)}...${txId.slice(-12)}`
    : txId
}
