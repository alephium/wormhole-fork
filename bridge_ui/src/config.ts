import { ChainId } from "@h0ngcha0/wormhole-sdk";
import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_CELO,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_NEON,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_TERRA,
  CHAIN_ID_SOLANA
} from "@h0ngcha0/wormhole-sdk";

export type DisableTransfers = boolean | "to" | "from";

export interface WarningMessage {
  text: string;
  link?: {
    url: string;
    text: string;
  };
}

export interface ChainConfig {
  disableTransfers?: DisableTransfers;
  warningMessage?: WarningMessage;
}

export type ChainConfigMap = {
  [key in ChainId]?: ChainConfig;
};

export const CHAIN_CONFIG_MAP: ChainConfigMap = {
  [CHAIN_ID_SOLANA]: {
    disableTransfers: true
  },
  [CHAIN_ID_ACALA]: {
    disableTransfers: true
  },
  [CHAIN_ID_ALGORAND]: {
    disableTransfers: true
  },
  [CHAIN_ID_AURORA]: {
    disableTransfers: true
  },
  [CHAIN_ID_AVAX]: {
    disableTransfers: true
  },
  [CHAIN_ID_CELO]: {
    disableTransfers: true
  },
  [CHAIN_ID_ETHEREUM_ROPSTEN]: {
    disableTransfers: true
  },
  [CHAIN_ID_FANTOM]: {
    disableTransfers: true
  },
  [CHAIN_ID_KARURA]: {
    disableTransfers: true
  },
  [CHAIN_ID_KLAYTN]: {
    disableTransfers: true
  },
  [CHAIN_ID_NEON]: {
    disableTransfers: true
  },
  [CHAIN_ID_OASIS]: {
    disableTransfers: true
  },
  [CHAIN_ID_POLYGON]: {
    disableTransfers: true
  },
  [CHAIN_ID_TERRA]: {
    disableTransfers: true
  },
  // [CHAIN_ID_POLYGON]: {
  //   disableTransfers: true,
  //   warningMessage: {
  //     text: "Polygon is currently experiencing partial downtime. As a precautionary measure, Wormhole Network and Portal have paused Polygon support until the network has been fully restored.",
  //     link: {
  //       url: "https://twitter.com/0xPolygonDevs",
  //       text: "Follow @0xPolygonDevs for updates",
  //     },
  //   },
  // } as ChainConfig,
};
