import {
  ChainId,
  CHAIN_ID_TERRA,
  hexToNativeString,
  isEVMChain,
  uint8ArrayToHex,
} from "@alephium/wormhole-sdk";
import { ActiveNetwork, useNetworkContext } from "../contexts/NetworkContext";
import { ChainID, chainIDs } from "./consts";
import { addressFromContractId } from '@alephium/web3'

const makeDate = (date: string): string => {
  const [_, month, day] = date.split("-");
  if (!month || !day) {
    throw Error("Invalid date supplied to makeDate. Expects YYYY-MM-DD.");
  }
  return `${month}/${day}`;
};
const makeGroupName = (
  groupKey: string,
  activeNetwork: ActiveNetwork,
  emitterChain?: number
): string => {
  let ALL = "All Wormhole messages";
  if (emitterChain) {
    ALL = `All ${ChainID[emitterChain]} messages`;
  }
  let group = groupKey === "*" ? ALL : groupKey;
  if (group.includes(":")) {
    // subKey is chainID:addresss
    const parts = groupKey.split(":");
    const chainName = ChainID[Number(parts[0])]
    group = chainName === undefined
      ? 'Governance'
      : `${chainName} ${contractNameFormatter(
        parts[1],
        Number(parts[0]),
        activeNetwork
      )}`;
  } else if (group != ALL) {
    // subKey is a chainID
    group = ChainID[Number(groupKey)] ?? 'Governance';
  }
  return group;
};

const getNativeAddress = (
  chainId: number,
  emitterAddress: string,
  activeNetwork?: ActiveNetwork
): string => {
  let nativeAddress = "";

  if (chainId === chainIDs["alephium"]) {
    nativeAddress = emitterAddress
  } else if (isEVMChain(chainId as ChainId)) {
    // remove zero-padding
    let unpadded = emitterAddress.slice(-40);
    nativeAddress = `0x${unpadded}`.toLowerCase();
  } else if (chainId === chainIDs["terra"]) {
    nativeAddress = (
      hexToNativeString(emitterAddress, CHAIN_ID_TERRA) || ""
    ).toLowerCase();
  }
  return nativeAddress;
};

const truncateAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const contractNameFormatter = (
  address: string,
  chainId: number,
  activeNetwork?: ActiveNetwork
): string => {
  if (!activeNetwork) {
    activeNetwork = useNetworkContext().activeNetwork;
  }

  const chainName = ChainID[chainId]?.toLowerCase();
  if (chainName === undefined) {
    return 'Governance'
  }
  let nativeAddress = getNativeAddress(chainId, address, activeNetwork);

  let truncated = truncateAddress(nativeAddress || address);
  let formatted = truncated;

  if (nativeAddress in activeNetwork.chains[chainName]) {
    // add the description of the contract, if we know it
    let desc = activeNetwork.chains[chainName][nativeAddress];
    formatted = `${desc} (${truncated})`;
  }
  return formatted;
};

const nativeExplorerContractUri = (
  chainId: number,
  address: string,
  activeNetwork?: ActiveNetwork
): string => {
  if (!activeNetwork) {
    activeNetwork = useNetworkContext().activeNetwork;
  }

  let nativeAddress = getNativeAddress(chainId, address, activeNetwork);
  if (nativeAddress) {
    let base = "";
    if (chainId === chainIDs["solana"]) {
      base = "https://explorer.solana.com/address/";
    } else if (chainId === chainIDs["ethereum"]) {
      base = activeNetwork.name === 'testnet'
        ? "https://sepolia.etherscan.io/address/"
        : activeNetwork.name === 'mainnet'
        ? "https://etherscan.io/address/"
        : "http://not_available"
    } else if (chainId === chainIDs["terra"]) {
      base = "https://finder.terra.money/columbus-5/address/";
    } else if (chainId === chainIDs["bsc"]) {
      base = activeNetwork.name === 'testnet'
        ? "https://testnet.bscscan.com/address/"
        : activeNetwork.name === 'mainnet'
        ? "https://bscscan.com/address/"
        : "http://not_available/"
    } else if (chainId === chainIDs["polygon"]) {
      base = "https://polygonscan.com/address/";
    } else if (chainId === chainIDs["avalanche"]) {
      base = "https://snowtrace.io/address/";
    } else if (chainId === chainIDs["oasis"]) {
      base = "https://explorer.oasis.updev.si/address/";
    } else if (chainId === chainIDs["fantom"]) {
      base = "https://ftmscan.com/address/";
    } else if (chainId === chainIDs["aurora"]) {
      base = "https://aurorascan.dev/address/";
    } else if (chainId === chainIDs["alephium"]) {
      nativeAddress = addressFromContractId(nativeAddress)
      base = activeNetwork.name === 'testnet'
        ? "https://testnet.alephium.org/addresses/"
        : activeNetwork.name === 'mainnet'
        ? "https://explorer.alephium.org/addresses/"
        : "http://localhost:30000/"
    }
    return `${base}${nativeAddress}`;
  }
  return "";
};
const nativeExplorerTxUri = (
  chainId: number,
  transactionId: string,
  activeNetwork?: ActiveNetwork
): string => {
  if (!activeNetwork) {
    activeNetwork = useNetworkContext().activeNetwork;
  }

  let base = "";
  if (chainId === chainIDs["ethereum"]) {
    const prefix = transactionId.startsWith('0x') ? '' : '0x'
    base = activeNetwork.name === 'testnet'
      ? `https://sepolia.etherscan.io/tx/${prefix}`
      : `https://etherscan.io/tx/${prefix}`
  } else if (chainId === chainIDs["bsc"]) {
    const prefix = transactionId.startsWith('0x') ? '' : '0x'
    base = activeNetwork.name === 'testnet'
      ? `https://testnet.bscscan.com/tx/${prefix}`
      : `https://bscscan.com/tx/${prefix}`
  } else if (chainId === chainIDs["alephium"]) {
    base = activeNetwork.name === 'testnet'
      ? 'https://testnet.alephium.org/transactions/'
      : 'https://explorer.alephium.org/transactions/'
  }

  if (base) {
    return `${base}${transactionId}`;
  }
  return "";
};

// define colors to represent chains in charts/graphs
const chainColors: { [chain: string]: string } = {
  "2": "hsl(235, 5%, 43%)",
  "4": "hsl(297, 100%, 61%)",
  "255": "hsl(54, 100%, 61%)",
};
const chainIdColors = Object.entries(chainColors).map(([, color]) => color)

const amountFormatter = (num: number, decimals?: number): string => {
  let absNum = Math.abs(num);
  if (absNum > 999 && absNum < 1000000) {
    return (num / 1000).toFixed(decimals !== undefined ? decimals : 1) + "K"; // convert to K with 1 decimal for 1000 < 1 million
  } else if (absNum >= 1000000 && absNum < 1000000000) {
    return (num / 1000000).toFixed(decimals !== undefined ? decimals : 0) + "M"; // convert to M for number from > 1 million
  } else if (absNum >= 1000000000) {
    return (
      (num / 1000000000).toFixed(decimals !== undefined ? decimals : 1) + "B"
    ); // convert to B for number from > 1 billion
  }
  return num.toFixed(decimals !== undefined ? decimals : 0); // if value < 1000, nothing to do
};
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function stringifyJson(json: any, space = 2): string {
  return JSON.stringify(json, (key, value) => {
    if (value instanceof Uint8Array) {
      return uint8ArrayToHex(value)
    }
    if (value?.type && value.type === 'Buffer') {
      return uint8ArrayToHex(value.data)
    }
    return value
  }, space)
}

export {
  amountFormatter,
  chainColors,
  chainIdColors,
  contractNameFormatter,
  getNativeAddress,
  makeDate,
  makeGroupName,
  nativeExplorerContractUri,
  nativeExplorerTxUri,
  truncateAddress,
  usdFormatter,
  stringifyJson
};
