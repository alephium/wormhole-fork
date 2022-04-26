import { BuildScriptTx, CliqueClient, Contract, Number256, Script, Signer, SubmissionResult, Val } from 'alephium-web3'
import * as blake from 'blakejs'
import { waitTxConfirmed } from './utils'

const Byte32Zero = "0000000000000000000000000000000000000000000000000000000000000000"
const AlephiumChainId = 13

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
    governance: DeployResult,
    tokenBridge: DeployResult,
    tokenWrapperFactory: DeployResult
    eventEmitter: DeployResult
}

export class Wormhole {
    client: CliqueClient
    signer: Signer
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
        signer: Signer,
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

    private contractInfo(contract: Contract, templateVariables?: any): ContractInfo {
        const bytecode = contract.buildByteCode(templateVariables)
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

    private async tokenBridgeForChainInfo(templateVariables: any): Promise<ContractInfo> {
        if (typeof this._tokenBridgeForChainInfo !== 'undefined') {
            return this._tokenBridgeForChainInfo as ContractInfo
        }
        const contract = await Contract.fromSource(this.client, 'token_bridge_for_chain.ral')
        const info = this.contractInfo(contract, templateVariables)
        this._tokenBridgeForChainInfo = info
        return info
    }

    private async undoneSequenceInfo(): Promise<ContractInfo> {
        if (typeof this._undoneSequenceInfo !== 'undefined') {
            return this._undoneSequenceInfo as ContractInfo
        }
        const contract = await Contract.fromSource(this.client, 'undone_sequence.ral')
        const info = this.contractInfo(contract, this.undoneSequenceTemplateVariables)
        this._undoneSequenceInfo = info
        return info
    }

    private undoneSequenceTemplateVariables = {
        undoneSequenceMaxSize: 128, // the maximum size of the contract state is 1k
        undoneSequenceMaxDistance: 512
    }

    async deployContracts(): Promise<WormholeContracts> {
        const eventEmitter = await this.deployEventEmitter()
        const tokenWrapperFactoryDeployResult = await this.deployTokenWrapperFactory(eventEmitter.contractId)
        const governanceDeployResult = await this.deployGovernance(
            eventEmitter.contractId, this.governanceChainId, this.governanceContractId,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            eventEmitter.contractId, tokenWrapperFactoryDeployResult.contractId, governanceDeployResult.contractId,
            this.tokenBridgeGovernanceChainId, this.tokenBridgeGovernanceContractId
        )
        return {
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
            tokenWrapperFactory: tokenWrapperFactoryDeployResult,
            eventEmitter: eventEmitter
        }
    }

    private async deployEventEmitter(): Promise<DeployResult> {
        const contract = await Contract.fromSource(this.client, 'event_emitter.ral')
        return this._deploy(contract)
    }

    private async deployTokenWrapperFactory(eventEmitterId: string): Promise<DeployResult> {
        const tokenWrapper = await this.tokenWrapperInfo()
        const tokenWrapperFactory = await Contract.fromSource(this.client, 'token_wrapper_factory.ral')
        return this._deploy(tokenWrapperFactory, undefined, {
            eventEmitterId: eventEmitterId,
            tokenWrapperByteCode: tokenWrapper.bytecode
        })
    }

    private async deployGovernance(
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
            AlephiumChainId, governanceChainId, governanceContractId, 0, 0, 0, '', initMessageFee,
            initGuardianSets, initGuardianIndexes, initGuardianSizes, previousGuardianSetExpirationTime
        ]
        const undoneSequence = await this.undoneSequenceInfo()
        const governanceDeployResult = await this._deploy(governance, initFields, {
            undoneSequenceCodeHash: undoneSequence.codeHash,
            eventEmitterId: eventEmitterId
        })
        const undoneSequenceDeployResult = await this.deployUndoneSequence(governanceDeployResult.contractId)
        await this.innitUndoneSequence(governanceDeployResult.contractId, undoneSequenceDeployResult.contractId)
        return governanceDeployResult
    }

    private async deployTokenBridge(
        eventEmitterId: string,
        tokenWrapperFactoryId: string,
        governanceId: string,
        governanceChainId: number,
        governanceContractId: string
    ): Promise<DeployResult> {
        const undoneSequence = await this.undoneSequenceInfo()
        const tokenWrapper = await this.tokenWrapperInfo()
        const sequenceTemplateVariables = {
            undoneSequenceCodeHash: undoneSequence.codeHash,
            eventEmitterId: eventEmitterId
        }
        const tokenBridgeForChain = await this.tokenBridgeForChainInfo({
            tokenWrapperFactoryId: tokenWrapperFactoryId,
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            ...sequenceTemplateVariables
        })
        const tokenBridge = await Contract.fromSource(this.client, 'token_bridge.ral')
        const initFields = [
            governanceId, governanceChainId, governanceContractId,
            0, 0, 0, '', AlephiumChainId, 0
        ]
        const tokenBridgeDeployResult = await this._deploy(tokenBridge, initFields, {
            tokenBridgeForChainByteCode: tokenBridgeForChain.bytecode,
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            ...sequenceTemplateVariables
        })
        const undoneSequenceDeployResult = await this.deployUndoneSequence(tokenBridgeDeployResult.contractId)
        await this.innitUndoneSequence(tokenBridgeDeployResult.contractId, undoneSequenceDeployResult.contractId)
        return tokenBridgeDeployResult
    }

    async registerChainToAlph(
        tokenBridgeId: string,
        vaa: string,
        payer: string,
        alphAmount: Number256,
        params?: BuildScriptTx,
    ): Promise<string> {
        const script = await Script.fromSource(this.client, "register_chain.ral")
        const scriptTx = await script.transactionForDeployment(this.signer, {
            payer: payer,
            tokenBridgeId: tokenBridgeId,
            vaa: vaa,
            alphAmount: alphAmount
        }, params)
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
            contractId: contractId,
            undoneSequenceId: undoneSequenceId
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
            tokenBridgeForChainId: tokenBridgeForChainId,
            tokenId: localTokenId,
            payer: payer,
            alphAmount: alphAmount,
        })
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }

    private async deployUndoneSequence(owner: string): Promise<DeployResult> {
        const info = await this.undoneSequenceInfo()
        return this._deploy(info.contract, [owner, ''], this.undoneSequenceTemplateVariables)
    }

    private async _deploy(
        contract: Contract,
        initFields?: Val[],
        templateVariables?: any
    ): Promise<DeployResult> {
        const deployTx = await contract.transactionForDeployment(this.signer, initFields, undefined, templateVariables)
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