import { binToHex, contractIdFromAddress } from 'alephium-web3'
import { Wormhole } from '../lib/wormhole'
import * as consts from './consts'
import { getCreatedContractAddress } from './get_contract_address'

export interface RemoteChains {
    eth: string,
    bsc: string
}

export async function registerChains(wormhole: Wormhole, tokenBridgeId: string): Promise<RemoteChains> {
    const registerEthVAA = process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!
    var txId = await wormhole.registerChainToAlph(tokenBridgeId, registerEthVAA, consts.payer, consts.dustAmount)
    const bridgeForEth = await getCreatedContractAddress(wormhole.provider, txId)
    console.log("register eth tx id: " + txId + ', contract address: ' + bridgeForEth)

    const registerBSCVAA = process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!
    txId = await wormhole.registerChainToAlph(tokenBridgeId, registerBSCVAA, consts.payer, consts.dustAmount)
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
