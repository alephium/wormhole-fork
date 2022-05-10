import { binToHex, contractIdFromAddress } from 'alephium-web3'
import { Wormhole } from '../lib/wormhole'
import * as env from './env'
import { getCreatedContractAddress } from './get_contract_address'

export interface RemoteChains {
    eth: string,
    terra: string,
    bsc: string
}

export async function registerChains(wormhole: Wormhole, tokenBridgeId: string): Promise<RemoteChains> {
    const payer = "12LgGdbjE6EtnTKw5gdBwV2RRXuXPtzYM7SDZ45YJTRht"
    const vaas = [
        // ETH, sequence = 0
        '01000000000100e2e1975d14734206e7a23d90db48a6b5b6696df72675443293c6057dcb936bf224b5df67d32967adeb220d4fe3cb28be515be5608c74aab6adb31099a478db5c1c000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e42726964676501000000020000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16',
        // Terra, sequence = 1
        '01000000000100e7d8469492e85b4f0df03a8bc1cdbf395f843ea181fb47188fcbf67b6df621fd005fad7ae7215752f0bfc6ff0f894dc4793cb46428e7582a369cfaeb05f334f31b000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000100000000000000000000000000000000000000000000546f6b656e4272696467650100000003000000000000000000000000784999135aaa8a3ca5914468852fdddbddd8789d',
        // BSC, sequence = 3
        '01000000000100f2766a939e1cde40d3a39218c4eaac273469f3e05edb7e55c0897eb7d565432550cbbec75013abfa30a3160d3915ffa7b6232c7062ea5fd8db62ba6bff6928691c000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000300000000000000000000000000000000000000000000546f6b656e42726964676501000000040000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16'
    ]

    var txId = await wormhole.registerChainToAlph(tokenBridgeId, vaas[0], payer, env.dustAmount)
    const bridgeForEth = await getCreatedContractAddress(wormhole.client, txId)
    console.log("register eth tx id: " + txId + ', contract address: ' + bridgeForEth)
    txId = await wormhole.registerChainToAlph(tokenBridgeId, vaas[1], payer, env.dustAmount)
    const bridgeForTerra = await getCreatedContractAddress(wormhole.client, txId)
    console.log("register terra tx id: " + txId + ', contract address: ' + bridgeForTerra)
    txId = await wormhole.registerChainToAlph(tokenBridgeId, vaas[2], payer, env.dustAmount)
    const bridgeForBsc = await getCreatedContractAddress(wormhole.client, txId)
    console.log("register bsc tx id: " + txId + ', contractAddress: ' + bridgeForBsc)

    const bridgeForEthId = binToHex(contractIdFromAddress(bridgeForEth))
    await wormhole.initTokenBridgeForChain(bridgeForEthId)
    const bridgeForTerraId = binToHex(contractIdFromAddress(bridgeForTerra))
    await wormhole.initTokenBridgeForChain(bridgeForTerraId)
    const bridgeForBscId = binToHex(contractIdFromAddress(bridgeForBsc))
    await wormhole.initTokenBridgeForChain(bridgeForBscId)

    return {
        eth: bridgeForEthId,
        terra: bridgeForTerraId,
        bsc: bridgeForBscId
    }
}
