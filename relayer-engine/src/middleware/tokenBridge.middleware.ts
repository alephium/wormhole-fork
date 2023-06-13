import { Middleware } from "../compose.middleware";
import {
  EVMChainId,
  VAA,
  TransferToken,
  VAAPayload,
  deserializeVAA,
  uint8ArrayToHex,
  alephium_contracts,
  CHAIN_ID_ALEPHIUM,
} from "alephium-wormhole-sdk";
import { ethers, Signer } from "ethers";
import { ProviderContext } from "./providers.middleware";
import { UnrecoverableError } from "bullmq";
import { TokenBridge, TokenBridge__factory } from "alephium-wormhole-sdk/lib/cjs/ethers-contracts";
import { encodeEmitterAddress, getTokenBridgeAddress } from "../utils";
import { addressFromContractId, NetworkId } from "@alephium/web3";

export interface TokenBridgeContext extends ProviderContext {
  tokenBridge: {
    contractConstructor: (
      address: string,
      signerOrProvider: Signer | ethers.providers.Provider,
    ) => TokenBridge;
    contracts: {
      read: {
        evm: {
          [k in EVMChainId]?: TokenBridge[];
        };
        alephium: alephium_contracts.TokenBridgeInstance;
      };
    };
    vaa?: VAA<TransferToken>;
    payload?: TransferToken;
  };
}

export type TokenBridgeChainConfigInfo = {
  evm: {
    [k in EVMChainId]: { contracts: TokenBridge[] };
  };
};

function instantiateReadEvmContracts(
  networkId: NetworkId,
  chainRpcs: Partial<Record<EVMChainId, ethers.providers.Provider[]>>,
) {
  const evmChainContracts: Partial<{
    [k in EVMChainId]: TokenBridge[];
  }> = {};
  for (const [chainIdStr, chainRpc] of Object.entries(chainRpcs)) {
    const chainId = Number(chainIdStr) as EVMChainId;
    // @ts-ignore
    const address = getTokenBridgeAddress(networkId, chainId);
    const contracts = chainRpc.map(rpc =>
      TokenBridge__factory.connect(address, rpc),
    );
    evmChainContracts[chainId] = contracts;
  }
  return evmChainContracts;
}

function isTokenBridgeVaa(networkId: NetworkId, vaa: VAA<VAAPayload>): boolean {
  const chainId = vaa.body.emitterChainId;
  const tokenBridgeLocalAddress = getTokenBridgeAddress(networkId, chainId);
  const emitterAddress = uint8ArrayToHex(vaa.body.emitterAddress);
  const tokenBridgeEmitterAddress = encodeEmitterAddress(chainId, tokenBridgeLocalAddress);
  return tokenBridgeEmitterAddress === emitterAddress;
}

function tryToParseTokenTransferVaa(
  vaaBytes: Uint8Array,
): VAA<TransferToken> | null {
  try {
    const vaa = deserializeVAA(vaaBytes);
    return vaa.body.payload.type === 'TransferToken' ? vaa as VAA<TransferToken> : null
  } catch (e) {
    // it may not be a token transfer vaa. TODO Maybe we want to do something to support attestations etc.
    return null;
  }
}

export function tokenBridgeContracts(): Middleware<TokenBridgeContext> {
  let evmContracts: Partial<{ [k in EVMChainId]: TokenBridge[] }>;

  return async (ctx: TokenBridgeContext, next) => {
    if (!ctx.providers) {
      throw new UnrecoverableError(
        "You need to first use the providers middleware.",
      );
    }
    if (!evmContracts) {
      ctx.logger?.debug(`Token Bridge Contracts initializing...`);
      evmContracts = instantiateReadEvmContracts(ctx.networkId, ctx.providers.evm);
      ctx.logger?.debug(`Token Bridge Contracts initialized`);
    }
    let parsedTokenTransferVaa = null;
    let payload = null;
    if (isTokenBridgeVaa(ctx.networkId, ctx.vaa.parsed)) {
      parsedTokenTransferVaa = tryToParseTokenTransferVaa(ctx.vaaBytes);
      if (parsedTokenTransferVaa) {
        payload = parsedTokenTransferVaa.body.payload
      }
    }

    const alephiumTokenBridgeAddress = addressFromContractId(getTokenBridgeAddress(ctx.networkId, CHAIN_ID_ALEPHIUM))
    ctx.tokenBridge = {
      contractConstructor: TokenBridge__factory.connect,
      contracts: {
        read: {
          evm: evmContracts,
          alephium: alephium_contracts.TokenBridge.at(alephiumTokenBridgeAddress)
        },
      },
      vaa: parsedTokenTransferVaa,
      payload: payload,
    };
    ctx.logger?.debug("Token Bridge contracts attached to context");
    await next();
  };
}
