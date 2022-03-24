import { CliqueClient, Contract, ContractState } from 'alephium-js'
import { createGovernance, governanceChainId, governanceContractAddress } from './governance-fixture'
import { alphChainId, ContractInfo, createMath, createSequence, createSerde, dustAmount, randomContractAddress, toContractId } from './wormhole-fixture'
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

export async function getTokenWrapperContract(client: CliqueClient, mathAddress: string): Promise<Contract> {
    return await Contract.from(client, 'token_wrapper.ral', {
        mathAddress: mathAddress,
        sequenceCodeHash: '00',
        serdeAddress: '00',
        tokenBridgeForChainBinCode: '00',
        tokenBridgeForChainCodeHash: '00',
        tokenWrapperCodeHash: '00',
        tokenWrapperFactoryAddress: '00',
        tokenWrapperBinCode: '00'
    })
}

export async function createTestToken(client: CliqueClient): Promise<ContractInfo> {
    const token = await Contract.from(client, 'token.ral')
    const address = randomContractAddress()
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = [
        toHex(randomBytes(32)), // symbol
        toHex(randomBytes(32)), // name
        8, // decimals
        tokenSupply // supply
    ]
    const state = token.toState(
        initFields, {alphAmount: dustAmount}, address
    )
    return new ContractInfo(token, state, [], address)
}

export async function createTokenWrapperFactory(
    client: CliqueClient,
    serdeInfo: ContractInfo,
    tokenWrapperContract: Contract
): Promise<ContractInfo> {
    const contract = await Contract.from(client, 'token_wrapper_factory.ral', {
        serdeAddress: serdeInfo.address,
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
    sequenceCodeHash: string,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string,
    mathAddress: string
): Promise<Contract> {
    return await Contract.from(client, 'token_bridge_for_chain.ral', {
        mathAddress: mathAddress,
        sequenceCodeHash: sequenceCodeHash,
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperBinCode: '00',
        serdeAddress: '00',
        tokenBridgeForChainBinCode: '00',
        tokenBridgeForChainCodeHash: '00',
    })
}

export class TokenBridgeInfo extends ContractInfo {
    serde: ContractInfo
    math: ContractInfo
    governance: ContractInfo
    tokenWrapperFactory: ContractInfo

    tokenWrapperContract: Contract
    tokenBridgeForChainContract: Contract

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        serde: ContractInfo,
        math: ContractInfo,
        governance: ContractInfo,
        tokenWrapperFctory: ContractInfo,
        tokenWrapperContract: Contract,
        tokenBridgeForChainContract: Contract
    ) {
        super(contract, selfState, deps, address)
        this.serde = serde
        this.math = math
        this.governance = governance
        this.tokenWrapperFactory = tokenWrapperFctory
        this.tokenWrapperContract = tokenWrapperContract
        this.tokenBridgeForChainContract = tokenBridgeForChainContract
    }
}

export async function createTokenBridge(client: CliqueClient): Promise<TokenBridgeInfo> {
    const serde = await createSerde(client)
    const math = await createMath(client)
    const governance = await createGovernance(client)
    const tokenWrapper = await getTokenWrapperContract(client, math.address)
    const tokenWrapperFactory = await createTokenWrapperFactory(client, serde, tokenWrapper)
    const tokenBridgeAddress = randomContractAddress()
    const sequence = await createSequence(client, tokenBridgeAddress)
    const tokenBridgeForChainContract = await getTokenBridgeForChainContract(
        client,
        sequence.contract.codeHash,
        tokenWrapperFactory.address,
        tokenWrapper.codeHash,
        math.address
    )
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', {
        mathAddress: math.address,
        sequenceCodeHash: sequence.contract.codeHash,
        serdeAddress: serde.address,
        tokenBridgeForChainBinCode: tokenBridgeForChainContract.bytecode,
        tokenBridgeForChainCodeHash: tokenBridgeForChainContract.codeHash,
        tokenWrapperCodeHash: tokenWrapper.codeHash
    })
    const state = tokenBridge.toState(
        [governance.address, governanceChainId, governanceContractAddress, true, sequence.address, alphChainId, 0],
        {alphAmount: dustAmount},
        tokenBridgeAddress
    )
    const deps = Array.prototype.concat(
        math.states(),
        serde.states(),
        governance.states(),
        sequence.states(),
        tokenWrapperFactory.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, serde, math, governance,
        tokenWrapperFactory, tokenWrapper, tokenBridgeForChainContract
    )
}

export async function createTokenBridgeForChain(
    client: CliqueClient,
    tokenBridgeInfo: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string
): Promise<ContractInfo> {
    const address = randomContractAddress()
    const sequence = await createSequence(client, address)
    const tokenBridgeForChain = tokenBridgeInfo.tokenBridgeForChainContract
    const state = tokenBridgeForChain.toState(
        [alphChainId, tokenBridgeInfo.address, remoteChainId, remoteTokenBridgeId, true, sequence.address],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenBridgeForChain, state, tokenBridgeInfo.states().concat(sequence.states()), address)
}

export async function createTokenWrapper(
    wrappedTokenId: string,
    tokenChainId: number,
    decimals: number,
    symbol: string,
    name: string,
    tokenBridgeInfo: TokenBridgeInfo,
    tokenBridgeForChainInfo: ContractInfo
): Promise<ContractInfo> {
    const tokenWrapperContract = tokenBridgeInfo.tokenWrapperContract
    const address = randomContractAddress()
    const state = tokenWrapperContract.toState(
        [tokenBridgeInfo.address, tokenBridgeForChainInfo.address, alphChainId, tokenChainId, wrappedTokenId, decimals, symbol, name],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(tokenWrapperContract, state, tokenBridgeForChainInfo.states(), address)
}
