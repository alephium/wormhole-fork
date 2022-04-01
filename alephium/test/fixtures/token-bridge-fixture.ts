import { CliqueClient, Contract, ContractState } from 'alephium-js'
import { createGovernance, governanceChainId, governanceContractAddress } from './governance-fixture'
import { alphChainId, ContractInfo, dustAmount, randomContractAddress, } from './wormhole-fixture'
import { randomBytes } from 'crypto'
import { toHex, zeroPad } from '../../lib/utils'

const tokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'

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
    return await Contract.from(client, 'token_wrapper.ral', {
        tokenBridgeForChainBinCode: '00',
        tokenWrapperCodeHash: '00',
        tokenWrapperFactoryAddress: '00',
        tokenWrapperBinCode: '00'
    })
}

export async function createTestToken(
    client: CliqueClient,
    decimals: number,
    symbol: string,
    name: string,
    supply?: bigint
): Promise<ContractInfo> {
    const token = await Contract.from(client, 'token.ral')
    const address = randomContractAddress()
    const tokenSupply = supply ? supply : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = [symbol, name, decimals, tokenSupply]
    const state = token.toState(initFields, {alphAmount: dustAmount}, address)
    return new ContractInfo(token, state, [], address)
}

export async function createTokenWrapperFactory(
    client: CliqueClient,
    tokenWrapperContract: Contract
): Promise<ContractInfo> {
    const contract = await Contract.from(client, 'token_wrapper_factory.ral', {
        tokenWrapperBinCode: tokenWrapperContract.bytecode
    })
    const address = randomContractAddress()
    const state = contract.toState(
        [], {alphAmount: dustAmount}, address
    )
    return new ContractInfo(contract, state, [], address)
}

export async function getTokenBridgeForChainContract(
    client: CliqueClient,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string
): Promise<Contract> {
    return await Contract.from(client, 'token_bridge_for_chain.ral', {
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperBinCode: '00',
        tokenBridgeForChainBinCode: '00'
    })
}

export class TokenBridgeInfo extends ContractInfo {
    governance: ContractInfo
    tokenWrapperFactory: ContractInfo

    tokenWrapperContract: Contract
    tokenBridgeForChainContract: Contract

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        governance: ContractInfo,
        tokenWrapperFctory: ContractInfo,
        tokenWrapperContract: Contract,
        tokenBridgeForChainContract: Contract
    ) {
        super(contract, selfState, deps, address)
        this.governance = governance
        this.tokenWrapperFactory = tokenWrapperFctory
        this.tokenWrapperContract = tokenWrapperContract
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

export async function createTokenBridge(client: CliqueClient): Promise<TokenBridgeInfo> {
    const governance = await createGovernance(client)
    const tokenWrapper = await getTokenWrapperContract(client)
    const tokenWrapperFactory = await createTokenWrapperFactory(client, tokenWrapper)
    const tokenBridgeAddress = randomContractAddress()
    const tokenBridgeForChainContract = await getTokenBridgeForChainContract(
        client,
        tokenWrapperFactory.address,
        tokenWrapper.codeHash,
    )
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', {
        tokenBridgeForChainBinCode: tokenBridgeForChainContract.bytecode,
        tokenWrapperCodeHash: tokenWrapper.codeHash
    })
    const initSequence = Array(20).fill(false)
    const state = tokenBridge.toState(
        [governance.address, governanceChainId, governanceContractAddress, 0, initSequence, initSequence, alphChainId, 0],
        {alphAmount: dustAmount},
        tokenBridgeAddress
    )
    const deps = Array.prototype.concat(
        governance.states(),
        tokenWrapperFactory.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, governance,
        tokenWrapperFactory, tokenWrapper, tokenBridgeForChainContract
    )
}

export async function createTokenBridgeForChain(
    tokenBridgeInfo: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string
): Promise<TokenBridgeForChainInfo> {
    const address = randomContractAddress()
    const tokenBridgeForChain = tokenBridgeInfo.tokenBridgeForChainContract
    const initSequence = Array(20).fill(false)
    const state = tokenBridgeForChain.toState(
        [alphChainId, tokenBridgeInfo.address, remoteChainId, remoteTokenBridgeId, 0, initSequence, initSequence],
        {alphAmount: dustAmount},
        address
    )
    return new TokenBridgeForChainInfo(tokenBridgeForChain, state, tokenBridgeInfo.states(), address, remoteChainId)
}

export async function createWrapper(
    tokenId: string,
    isNativeToken: boolean,
    decimals: number,
    symbol: string,
    name: string,
    tokenBridgeInfo: TokenBridgeInfo,
    tokenBridgeForChainInfo: TokenBridgeForChainInfo 
): Promise<ContractInfo> {
    const tokenWrapperContract = tokenBridgeInfo.tokenWrapperContract
    const address = randomContractAddress()
    const state = tokenWrapperContract.toState(
        [tokenBridgeInfo.address, tokenBridgeForChainInfo.address, alphChainId,
        tokenBridgeForChainInfo.remoteChainId, tokenId, isNativeToken, decimals, symbol, name],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenWrapperContract, state, tokenBridgeForChainInfo.states(), address)
}
