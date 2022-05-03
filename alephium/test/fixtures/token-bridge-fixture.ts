import { CliqueClient, Contract, ContractState } from 'alephium-web3'
import { createGovernance, governanceChainId, governanceContractAddress } from './governance-fixture'
import { alphChainId, ContractInfo, dustAmount, randomContractAddress, randomContractId, toContractId } from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUndoneSequence } from './sequence-fixture'
import * as blake from 'blakejs'

export const tokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'

export class AttestToken {
    tokenId: string
    tokenChainId: number
    symbol: string
    name: string
    decimals: number

    constructor(tokenId: string, tokenChainId: number, symbol: string, name: string, decimals: number) {
        this.tokenId = tokenId
        this.tokenChainId = tokenChainId
        this.symbol = symbol
        this.name = name
        this.decimals = decimals
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(100)
        buffer.writeUint8(2, 0) // payloadId
        buffer.write(this.tokenId, 1, 'hex')
        buffer.writeUInt16BE(this.tokenChainId, 33)
        buffer.writeUint8(this.decimals, 35)
        buffer.write(this.symbol, 36, 'hex')
        buffer.write(this.name, 68, 'hex')
        return buffer
    }
}

export class RegisterChain {
    targetChainId: number
    remoteChainId: number
    remoteTokenBridgeId: string

    constructor(targetChainId: number, remoteChainId: number, remoteTokenBridgeId: string) {
        this.targetChainId = targetChainId
        this.remoteChainId = remoteChainId
        this.remoteTokenBridgeId = remoteTokenBridgeId
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(69)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(1, 32) // actionId
        buffer.writeUint16BE(this.targetChainId, 33)
        buffer.writeUint16BE(this.remoteChainId, 35)
        buffer.write(this.remoteTokenBridgeId, 37, 'hex')
        return buffer
    }
}

export class CompleteFailedTransfer {
    tokenWrapperId: string
    failedSequence: number
    toAddress: string
    amount: bigint
    arbiterFee: bigint

    constructor(tokenWrapperId: string, failedSequence: number, toAddress: string, amount: bigint, arbiterFee: bigint) {
        this.tokenWrapperId = tokenWrapperId
        this.failedSequence = failedSequence
        this.toAddress = toAddress
        this.amount = amount
        this.arbiterFee = arbiterFee
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(169)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(3, 32)
        buffer.writeBigUint64BE(BigInt(this.failedSequence), 33)
        buffer.write(this.tokenWrapperId, 41, 'hex')
        buffer.write(this.toAddress, 73, 'hex')
        buffer.write(zeroPad(this.amount.toString(16), 32), 105, 'hex')
        buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 137, 'hex')
        return buffer
    }
}

export class Transfer {
    amount: bigint
    tokenId: string
    tokenChainId: number
    recipient: string
    recipientChainId: number
    arbiterFee: bigint

    constructor(amount: bigint, tokenId: string, tokenChainId: number, recipient: string, recipientChainId: number, arbiterFee: bigint) {
        this.amount = amount
        this.tokenId = tokenId
        this.tokenChainId = tokenChainId
        this.recipient = recipient
        this.recipientChainId = recipientChainId 
        this.arbiterFee = arbiterFee
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(133)
        buffer.writeUint8(1, 0) // payloadId
        buffer.write(zeroPad(this.amount.toString(16), 32), 1, 'hex')
        buffer.write(this.tokenId, 33, 'hex')
        buffer.writeUint16BE(this.tokenChainId, 65)
        buffer.write(this.recipient, 67, 'hex')
        buffer.writeUint16BE(this.recipientChainId, 99)
        buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 101, 'hex')
        return buffer
    }
}

export async function getTokenWrapperContract(client: CliqueClient): Promise<Contract> {
    return await Contract.fromSource(client, 'token_wrapper.ral')
}

export async function createTestToken(
    client: CliqueClient,
    decimals: number,
    symbol: string,
    name: string,
    supply?: bigint
): Promise<ContractInfo> {
    const token = await Contract.fromSource(client, 'test_token.ral')
    const address = randomContractAddress()
    const tokenSupply = supply ? supply : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = [symbol, name, decimals, tokenSupply]
    const state = token.toState(initFields, {alphAmount: dustAmount}, address)
    return new ContractInfo(token, state, [], address)
}

export class TokenBridgeInfo extends ContractInfo {
    governance: ContractInfo

    tokenWrapperContract: Contract
    tokenWrapperCodeHash: string
    tokenBridgeForChainContract: Contract

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        governance: ContractInfo,
        tokenWrapperContract: Contract,
        tokenWrapperCodeHash: string,
        tokenBridgeForChainContract: Contract
    ) {
        super(contract, selfState, deps, address)
        this.governance = governance
        this.tokenWrapperContract = tokenWrapperContract
        this.tokenWrapperCodeHash = tokenWrapperCodeHash
        this.tokenBridgeForChainContract = tokenBridgeForChainContract
    }
}

export class TokenBridgeForChainInfo extends ContractInfo {
    remoteChainId: number

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        remoteChainId: number
    ) {
        super(contract, selfState, deps, address)
        this.remoteChainId = remoteChainId
    }
}

async function createTemplateTokenWrapper(client: CliqueClient): Promise<ContractInfo> {
    const tokenWrapper = await Contract.fromSource(client, 'token_wrapper.ral')
    const address = randomContractAddress()
    const state = tokenWrapper.toState(
        ["", "", 0, 0, "", true, 0, "", ""],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenWrapper, state, [], address)
}

async function createTemplateTokenBridgeForChain(client: CliqueClient): Promise<ContractInfo> {
    const tokenBridgeForChain = await Contract.fromSource(client, 'token_bridge_for_chain.ral')
    const address = randomContractAddress()
    const state = tokenBridgeForChain.toState(
        ["", 0, "", 0, "", 0, 0, 0, "", "", "", "", ""],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenBridgeForChain, state, [], address)
}

export async function createTokenBridge(
    client: CliqueClient,
    eventEmitter: ContractInfo
): Promise<TokenBridgeInfo> {
    const governance = await createGovernance(client, eventEmitter)
    const tokenWrapper = await createTemplateTokenWrapper(client)
    const tokenBridgeForChain = await createTemplateTokenBridgeForChain(client)

    const tokenBridgeAddress = randomContractAddress()
    const tokenBridgeId = toContractId(tokenBridgeAddress)
    const undoneSequence = await createUndoneSequence(client, tokenBridgeId)
    const tokenBridge = await Contract.fromSource(client, 'token_bridge.ral')
    const initFields = [
        governance.contractId, governanceChainId, governanceContractAddress, 0, 0, 0,
        undoneSequence.contractId, alphChainId, 0, tokenWrapper.contractId, tokenBridgeForChain.contractId,
        tokenWrapper.codeHash, undoneSequence.codeHash, eventEmitter.contractId
    ]
    const state = tokenBridge.toState(
        initFields,
        {alphAmount: dustAmount},
        tokenBridgeAddress
    )
    const deps = Array.prototype.concat(
        eventEmitter.states(),
        governance.states(),
        tokenWrapper.states(),
        tokenBridgeForChain.states(),
        undoneSequence.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, governance,
        tokenWrapper.contract, tokenWrapper.codeHash, tokenBridgeForChain.contract
    )
}

export async function createTokenBridgeForChain(
    client: CliqueClient,
    eventEmitter: ContractInfo,
    tokenBridge: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string
): Promise<TokenBridgeForChainInfo> {
    const address = randomContractAddress()
    const undoneSequence = await createUndoneSequence(client, address)
    const tokenWrapper = await createTemplateTokenWrapper(client)
    const tokenBridgeForChainContract = await Contract.fromSource(client, "token_bridge_for_chain.ral")
    const initFields = [
        tokenBridge.governance.contractId, alphChainId, tokenBridge.contractId,
        remoteChainId, remoteTokenBridgeId, 0, 0, 0, undoneSequence.contractId,
        tokenWrapper.contractId, tokenWrapper.codeHash, undoneSequence.codeHash, eventEmitter.contractId
    ]
    const state = tokenBridgeForChainContract.toState(
        initFields,
        {alphAmount: dustAmount},
        address
    )
    const deps = Array.prototype.concat(
        tokenBridge.states(),
        tokenWrapper.states(),
        undoneSequence.states()
    )
    return new TokenBridgeForChainInfo(tokenBridgeForChainContract, state, deps, address, remoteChainId)
}

export async function createWrapper(
    tokenId: string,
    isLocalToken: boolean,
    decimals: number,
    symbol: string,
    name: string,
    tokenBridgeInfo: TokenBridgeInfo,
    tokenBridgeForChainInfo: TokenBridgeForChainInfo 
): Promise<ContractInfo> {
    const tokenWrapperContract = tokenBridgeInfo.tokenWrapperContract
    const address = randomContractAddress()
    const state = tokenWrapperContract.toState(
        [tokenBridgeInfo.contractId, tokenBridgeForChainInfo.contractId, alphChainId,
        tokenBridgeForChainInfo.remoteChainId, tokenId, isLocalToken, decimals, symbol, name],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenWrapperContract, state, tokenBridgeForChainInfo.states(), address)
}
