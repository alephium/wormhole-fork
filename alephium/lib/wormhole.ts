import { CliqueClient, Contract, Number256, Script, SingleAddressSigner, SubmissionResult, Val } from 'alephium-web3'
import * as blake from 'blakejs'
import { waitTxConfirmed } from './utils'

const Byte32Zero = "0000000000000000000000000000000000000000000000000000000000000000"
const AlephiumChainId = 13

const undoneSequenceMaxSize = 128 // the maximum size of the contract state is 1k
const undoneSequenceMaxDistance = 512

export interface DeployResult {
    groupIndex: number,
    contractAddress: string,
    contractId: string,
    txId: string,
    blockHash: string
}

interface ContractInfo {
    contract: Contract
    bytecode: string
    codeHash: string
}

export interface WormholeContracts {
    tokenWrapperCodeHash: string
    eventEmitter: DeployResult
    governance: DeployResult
    tokenBridge: DeployResult
}

export class Wormhole {
    client: CliqueClient
    signer: SingleAddressSigner
    governanceChainId: number
    governanceContractId: string
    tokenBridgeGovernanceChainId: number
    tokenBridgeGovernanceContractId: string
    initGuardianSet: string[]
    initGuardianSetIndex: number
    initMessageFee: bigint

    private _tokenWrapperInfo: ContractInfo | undefined = undefined
    private _tokenBridgeForChainInfo: ContractInfo | undefined = undefined
    private _undoneSequenceInfo: ContractInfo | undefined = undefined

    constructor(
        client: CliqueClient,
        signer: SingleAddressSigner,
        governanceChainId: number,
        governanceContractId: string,
        tokenBridgeGovernanceChainId: number,
        tokenBridgeGovernanceContractId: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ) {
        this.client = client
        this.signer = signer
        this.governanceChainId = governanceChainId
        this.governanceContractId = governanceContractId
        this.tokenBridgeGovernanceChainId = tokenBridgeGovernanceChainId
        this.tokenBridgeGovernanceContractId = tokenBridgeGovernanceContractId
        this.initGuardianSet = initGuardianSet
        this.initGuardianSetIndex = initGuardianSetIndex
        this.initMessageFee = initMessageFee
    }

    private contractInfo(contract: Contract): ContractInfo {
        const bytecode = contract.buildByteCode()
        const codeHash = Buffer.from(blake.blake2b(Buffer.from(bytecode, 'hex'), undefined, 32)).toString('hex')
        return {
            contract: contract,
            bytecode: bytecode,
            codeHash: codeHash
        }
    }

    private async tokenWrapperInfo(): Promise<ContractInfo> {
        if (typeof this._tokenWrapperInfo !== 'undefined') {
            return this._tokenWrapperInfo as ContractInfo
        }
        const contract = await Contract.fromSource(this.client, 'token_wrapper.ral')
        const info = this.contractInfo(contract)
        this._tokenWrapperInfo = info
        return info
    }

    private async tokenBridgeForChainInfo(): Promise<ContractInfo> {
        if (typeof this._tokenBridgeForChainInfo !== 'undefined') {
            return this._tokenBridgeForChainInfo as ContractInfo
        }
        const contract = await Contract.fromSource(this.client, 'token_bridge_for_chain.ral')
        const info = this.contractInfo(contract)
        this._tokenBridgeForChainInfo = info
        return info
    }

    private async undoneSequenceInfo(): Promise<ContractInfo> {
        if (typeof this._undoneSequenceInfo !== 'undefined') {
            return this._undoneSequenceInfo as ContractInfo
        }
        const contract = await Contract.fromSource(this.client, 'undone_sequence.ral')
        const info = this.contractInfo(contract)
        this._undoneSequenceInfo = info
        return info
    }

    async deployContracts(): Promise<WormholeContracts> {
        const eventEmitter = await this.deployEventEmitter()
        const undoneSequence = await this.undoneSequenceInfo()
        const governanceDeployResult = await this.deployGovernance(
            undoneSequence.codeHash, eventEmitter.contractId, this.governanceChainId, this.governanceContractId,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            undoneSequence.codeHash, eventEmitter.contractId,  governanceDeployResult.contractId,
            this.tokenBridgeGovernanceChainId, this.tokenBridgeGovernanceContractId
        )
        const tokenWrapper = await this.tokenWrapperInfo()
        return {
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            eventEmitter: eventEmitter,
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
        }
    }

    private async deployEventEmitter(): Promise<DeployResult> {
        const contract = await Contract.fromSource(this.client, 'event_emitter.ral')
        return this._deploy(contract)
    }

    private async deployGovernance(
        undoneSequenceCodeHash: string,
        eventEmitterId: string,
        governanceChainId: number,
        governanceContractId: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ): Promise<DeployResult> {
        const governance = await Contract.fromSource(this.client, 'governance.ral')
        const previousGuardianSet = Array<string>(19).fill(Byte32Zero)
        const initGuardianSetSize = initGuardianSet.length
        if (initGuardianSetSize > 19) {
            throw Error("init guardian set size larger than 19")
        }

        const currentGuardianSet = initGuardianSet.concat(Array(19 - initGuardianSetSize).fill(Byte32Zero))
        const initGuardianSets = Array(previousGuardianSet, currentGuardianSet)
        const initGuardianIndexes = Array(0, initGuardianSetIndex)
        const initGuardianSizes = Array(0, initGuardianSet.length)
        const previousGuardianSetExpirationTime = 0
        const initFields = [
            AlephiumChainId, governanceChainId, governanceContractId, 0, 0, 0, '', initMessageFee, initGuardianSets,
            initGuardianIndexes, initGuardianSizes, previousGuardianSetExpirationTime, undoneSequenceCodeHash, eventEmitterId
        ]
        const governanceDeployResult = await this._deploy(governance, initFields)
        const undoneSequenceDeployResult = await this.deployUndoneSequence(governanceDeployResult.contractId)
        await this.innitUndoneSequence(governanceDeployResult.contractId, undoneSequenceDeployResult.contractId)
        return governanceDeployResult
    }

    private async deployTokenBridge(
        undoneSequenceCodeHash: string,
        eventEmitterId: string,
        governanceId: string,
        governanceChainId: number,
        governanceContractId: string
    ): Promise<DeployResult> {
        const tokenWrapper = await this.tokenWrapperInfo()
        const dummyChainId: number = 0xffffffff
        const tokenWrapperInitFields = ["", "", dummyChainId, dummyChainId, "", true, 0, "", ""]
        const tokenWrapperDeployResult = await this._deploy(tokenWrapper.contract, tokenWrapperInitFields)

        const tokenBridgeForChain = await this.tokenBridgeForChainInfo()
        const tokenBridgeForChainInitFields = [
            "", dummyChainId, "", dummyChainId, "", 0, 0, 0, "", "", "", "", ""
        ]
        const tokenBridgeForChainDeployResult = await this._deploy(tokenBridgeForChain.contract, tokenBridgeForChainInitFields)

        const tokenBridge = await Contract.fromSource(this.client, 'token_bridge.ral')
        const initFields = [
            governanceId, governanceChainId, governanceContractId, 0, 0, 0, '', AlephiumChainId, 0,
            tokenWrapperDeployResult.contractId, tokenBridgeForChainDeployResult.contractId,
            tokenWrapper.codeHash, undoneSequenceCodeHash, eventEmitterId
        ]
        const tokenBridgeDeployResult = await this._deploy(tokenBridge, initFields)
        const undoneSequenceDeployResult = await this.deployUndoneSequence(tokenBridgeDeployResult.contractId)
        await this.innitUndoneSequence(tokenBridgeDeployResult.contractId, undoneSequenceDeployResult.contractId)
        return tokenBridgeDeployResult
    }

    async registerChainToAlph(
        tokenBridgeId: string,
        vaa: string,
        payer: string,
        alphAmount: Number256
    ): Promise<string> {
        const script = await Script.fromSource(this.client, "register_chain.ral")
        const scriptTx = await script.transactionForDeployment(this.signer, {
            templateVariables: {
                payer: payer,
                tokenBridgeId: tokenBridgeId,
                vaa: vaa,
                alphAmount: alphAmount
            }
        })
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return submitResult.txId
    }

    async initTokenBridgeForChain(tokenBridgeForChainId: string): Promise<SubmissionResult> {
        const undoneSequenceDeployResult = await this.deployUndoneSequence(tokenBridgeForChainId)
        return this.innitUndoneSequence(tokenBridgeForChainId, undoneSequenceDeployResult.contractId)
    }

    private async innitUndoneSequence(
        contractId: string,
        undoneSequenceId: string
    ): Promise<SubmissionResult> {
        const script = await Script.fromSource(this.client, 'init_undone_sequence.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            templateVariables: {
                contractId: contractId,
                undoneSequenceId: undoneSequenceId
            }
        })
        return this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    }

    async createWrapperForLocalToken(
        tokenBridgeForChainId: string,
        localTokenId: string,
        payer: string,
        alphAmount: bigint
    ): Promise<string> {
        const script = await Script.fromSource(this.client, 'create_local_wrapper.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            templateVariables: {
                tokenBridgeForChainId: tokenBridgeForChainId,
                tokenId: localTokenId,
                payer: payer,
                alphAmount: alphAmount
            }
        })
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }

    private async deployUndoneSequence(owner: string): Promise<DeployResult> {
        const info = await this.undoneSequenceInfo()
        return this._deploy(info.contract, [owner, '', undoneSequenceMaxSize, undoneSequenceMaxDistance])
    }

    private async _deploy(contract: Contract, initFields?: Val[]): Promise<DeployResult> {
        const deployTx = await contract.transactionForDeployment(this.signer, {
            initialFields: initFields
        })
        const submitResult = await this.signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
        const confirmed = await waitTxConfirmed(this.client, submitResult.txId)
        return {
            groupIndex: deployTx.group,
            contractAddress: deployTx.contractAddress,
            contractId: deployTx.contractId,
            txId: submitResult.txId,
            blockHash: confirmed.blockHash
        }
    }
}
