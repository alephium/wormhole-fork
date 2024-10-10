import { hexToBinUnsafe } from "@alephium/web3"
import { CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH, TransferToken, tryNativeToHexString, VAA } from "../utils"
import { needToReward } from "./redeem"

describe('redeem', () => {
  const tokens = [
    {
      id: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      minimal: '10000000000000000',
      decimals: 18
    },
    {
      id: '0x55d398326f99059ff775485246999027b3197955',
      minimal: '10000000',
      decimals: 6
    }
  ]

  it('needToReward', () => {
    const vaa: VAA<TransferToken> = {
      version: 0,
      guardianSetIndex: 0,
      signatures: [],
      body: {
        timestamp: 0,
        nonce: 0,
        emitterChainId: CHAIN_ID_BSC,
        targetChainId: CHAIN_ID_ALEPHIUM,
        emitterAddress: new Uint8Array([]),
        sequence: BigInt(0),
        consistencyLevel: 10,
        payload: {
          type: 'TransferToken',
          amount: BigInt(1000000),
          originAddress: hexToBinUnsafe(tryNativeToHexString(tokens[0].id, CHAIN_ID_BSC)),
          originChain: CHAIN_ID_BSC,
          targetAddress: new Uint8Array([]),
          fee: BigInt(0)
        }
      }
    }

    expect(needToReward(vaa, tokens)).toEqual(true)
    expect(needToReward({
      ...vaa,
      body: {
        ...vaa.body,
        payload: {
          ...vaa.body.payload,
          amount: BigInt(1000001)
        }
      }
    }, tokens)).toEqual(true)
    expect(needToReward({
      ...vaa,
      body: {
        ...vaa.body,
        payload: {
          ...vaa.body.payload,
          amount: BigInt(999999)
        }
      }
    }, tokens)).toEqual(false)
    expect(needToReward(vaa, tokens.slice(1))).toEqual(false)
    expect(needToReward({
      ...vaa,
      body: {
        ...vaa.body,
        emitterChainId: CHAIN_ID_ETH
      }
    }, tokens)).toEqual(true)
    expect(needToReward({
      ...vaa,
      body: {
        ...vaa.body,
        targetChainId: CHAIN_ID_ETH
      }
    }, tokens)).toEqual(false)
    expect(needToReward({
      ...vaa,
      body: {
        ...vaa.body,
        payload: {
          ...vaa.body.payload,
          originChain: CHAIN_ID_ETH
        }
      }
    }, tokens)).toEqual(false)
  })
})
