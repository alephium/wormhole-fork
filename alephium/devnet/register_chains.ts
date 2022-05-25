import { binToHex, contractIdFromAddress } from 'alephium-web3'
import { Wormhole } from '../lib/wormhole'
import * as env from './env'
import { getCreatedContractAddress } from './get_contract_address'

export interface RemoteChains {
    eth: string,
    bsc: string
}

export async function registerChains(wormhole: Wormhole, tokenBridgeId: string): Promise<RemoteChains> {
    const registerEthVAA = '01000000000100e2e1975d14734206e7a23d90db48a6b5b6696df72675443293c6057dcb936bf224b5df67d32967adeb220d4fe3cb28be515be5608c74aab6adb31099a478db5c01000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e42726964676501000000020000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16'
    var txId = await wormhole.registerChainToAlph(tokenBridgeId, registerEthVAA, env.payer, env.dustAmount)
    const bridgeForEth = await getCreatedContractAddress(wormhole.provider, txId)
    console.log("register eth tx id: " + txId + ', contract address: ' + bridgeForEth)

    const registerBSCVAA = '01000000000100fd9f9aaa5c2759478dc7e59f7b80a2d0a99a4cb81c007e4c731a30415b8ca6091012c79b172582763f9a6b8232bd250d03ebb760193be1fa191ce9d01646a88900000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000100000000000000000000000000000000000000000000546f6b656e42726964676501000000040000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16'
    txId = await wormhole.registerChainToAlph(tokenBridgeId, registerBSCVAA, env.payer, env.dustAmount)
    const bridgeForBsc = await getCreatedContractAddress(wormhole.provider, txId)
    console.log("register bsc tx id: " + txId + ', contractAddress: ' + bridgeForBsc)

    const bridgeForEthId = binToHex(contractIdFromAddress(bridgeForEth))
    await wormhole.initTokenBridgeForChain(bridgeForEthId)
    const bridgeForBscId = binToHex(contractIdFromAddress(bridgeForBsc))
    await wormhole.initTokenBridgeForChain(bridgeForBscId)

    return {
        eth: bridgeForEthId,
        bsc: bridgeForBscId
    }
}
