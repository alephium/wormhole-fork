import { CliqueClient } from 'alephium-js'
import { Confirmed, TxStatus } from 'alephium-js/api/alephium'
import { Wormhole } from '../lib/wormhole'
import * as env from './env'

export interface RemoteChains {
    eth: string,
    terra: string,
    solana: string,
    bsc: string
}

function isConfirmed(txStatus: TxStatus): txStatus is Confirmed {
    return (txStatus as Confirmed).blockHash !== undefined
}

async function getTokenBridgeForChainContractAddress(client: CliqueClient, txId: string): Promise<string> {
    const status = await client.transactions.getTransactionsStatus({txId: txId})
    if (!isConfirmed(status.data)) {
        console.log(txId + ' is not confirmed')
        await new Promise(r => setTimeout(r, 2000))
        return getTokenBridgeForChainContractAddress(client, txId)
    }

    const block = await client.blockflow.getBlockflowBlocksBlockHash(status.data.blockHash)
    const tx = block.data.transactions[status.data.txIndex]
    return tx.generatedOutputs[0].address
}

export async function registerChains(wormhole: Wormhole, tokenBridgeAddress: string): Promise<RemoteChains> {
    const payer = "12LgGdbjE6EtnTKw5gdBwV2RRXuXPtzYM7SDZ45YJTRht"
    const alphAmount = BigInt("1000000000000000000")
    const vaas = [
        // ETH, sequence = 0
        '01000000000100e2e1975d14734206e7a23d90db48a6b5b6696df72675443293c6057dcb936bf224b5df67d32967adeb220d4fe3cb28be515be5608c74aab6adb31099a478db5c1c000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e42726964676501000000020000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16',
        // Terra, sequence = 1
        '01000000000100e7d8469492e85b4f0df03a8bc1cdbf395f843ea181fb47188fcbf67b6df621fd005fad7ae7215752f0bfc6ff0f894dc4793cb46428e7582a369cfaeb05f334f31b000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000100000000000000000000000000000000000000000000546f6b656e4272696467650100000003000000000000000000000000784999135aaa8a3ca5914468852fdddbddd8789d',
        // Solana, sequence = 2
        '010000000001001501232cc660aab7e2a84099fa7823048c2cab4834b1c3579656bd02b8686134150d3d69ab5bfda5aec1aa53bb3fcd89969462faa3cfd08551b36ed45b1202851c000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000200000000000000000000000000000000000000000000546f6b656e4272696467650100000001c69a1b1a65dd336bf1df6a77afb501fc25db7fc0938cb08595a9ef473265cb4f',
        // BSC, sequence = 3
        '01000000000100f2766a939e1cde40d3a39218c4eaac273469f3e05edb7e55c0897eb7d565432550cbbec75013abfa30a3160d3915ffa7b6232c7062ea5fd8db62ba6bff6928691c000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000300000000000000000000000000000000000000000000546f6b656e42726964676501000000040000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16'
    ]
    const params = {
        alphAmount: alphAmount,
        gas: 500000
    }

    var txId = await wormhole.registerChainToAlph(tokenBridgeAddress, vaas[0], payer, env.dustAmount, params)
    const bridgeForEth = await getTokenBridgeForChainContractAddress(wormhole.client, txId)
    console.log("register eth tx id: " + txId + ', contract address: ' + bridgeForEth)
    txId = await wormhole.registerChainToAlph(tokenBridgeAddress, vaas[1], payer, env.dustAmount, params)
    const bridgeForTerra = await getTokenBridgeForChainContractAddress(wormhole.client, txId)
    console.log("register terra tx id: " + txId + ', contract address: ' + bridgeForTerra)
    txId = await wormhole.registerChainToAlph(tokenBridgeAddress, vaas[2], payer, env.dustAmount, params)
    const bridgeForSolana = await getTokenBridgeForChainContractAddress(wormhole.client, txId)
    console.log("register solana tx id: " + txId + ', contract address: ' + bridgeForSolana)
    txId = await wormhole.registerChainToAlph(tokenBridgeAddress, vaas[3], payer, env.dustAmount, params)
    const bridgeForBsc = await getTokenBridgeForChainContractAddress(wormhole.client, txId)
    console.log("register bsc tx id: " + txId + ', contractAddress: ' + bridgeForBsc)

    await wormhole.initTokenBridgeForChain(bridgeForEth)
    await wormhole.initTokenBridgeForChain(bridgeForTerra)
    await wormhole.initTokenBridgeForChain(bridgeForSolana)
    await wormhole.initTokenBridgeForChain(bridgeForBsc)

    return {
        eth: bridgeForEth,
        terra: bridgeForTerra,
        solana: bridgeForSolana,
        bsc: bridgeForBsc
    }
}
