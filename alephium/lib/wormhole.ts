import { NodeProvider, Contract, Number256, Script, SignerWithNodeProvider, SubmissionResult, Fields } from 'alephium-web3'
import { waitTxConfirmed } from './utils'

const Byte32Zero = "0000000000000000000000000000000000000000000000000000000000000000"
const CHAIN_ID_ALEPHIUM = 255
const undoneSequenceMaxSize = 128 // the maximum size of the contract state is 1k
const undoneSequenceMaxDistance = 512

export interface DeployResult {
    fromGroup: number
    toGroup: number
    contractAddress: string
    contractId: string
    txId: string
    blockHash: string
}

export interface WormholeContracts {
    tokenWrapperCodeHash: string
    eventEmitter: DeployResult
    governance: DeployResult
    tokenBridge: DeployResult
}

export class Wormhole {
    provider: NodeProvider
    signer: SignerWithNodeProvider
    governanceChainId: number
    governanceContractId: string
    tokenBridgeGovernanceChainId: number
    tokenBridgeGovernanceContractId: string
    initGuardianSet: string[]
    initGuardianSetIndex: number
    initMessageFee: bigint

    private _tokenWrapperContract: Contract | undefined = undefined
    private _tokenBridgeForChainContract: Contract | undefined = undefined
    private _undoneSequenceContract: Contract | undefined = undefined

    constructor(
        provider: NodeProvider,
        signer: SignerWithNodeProvider,
        governanceChainId: number,
        governanceContractId: string,
        tokenBridgeGovernanceChainId: number,
        tokenBridgeGovernanceContractId: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ) {
        this.provider = provider
        this.signer = signer
        this.governanceChainId = governanceChainId
        this.governanceContractId = governanceContractId
        this.tokenBridgeGovernanceChainId = tokenBridgeGovernanceChainId
        this.tokenBridgeGovernanceContractId = tokenBridgeGovernanceContractId
        this.initGuardianSet = initGuardianSet
        this.initGuardianSetIndex = initGuardianSetIndex
        this.initMessageFee = initMessageFee
    }

    private async tokenWrapperContract(): Promise<Contract> {
        if (typeof this._tokenWrapperContract !== 'undefined') {
            return this._tokenWrapperContract as Contract
        }
        const contract = await Contract.fromSource(this.provider, 'token_wrapper.ral')
        this._tokenWrapperContract = contract
        return contract
    }

    private async tokenBridgeForChainContract(): Promise<Contract> {
        if (typeof this._tokenBridgeForChainContract !== 'undefined') {
            return this._tokenBridgeForChainContract as Contract
        }
        const contract = await Contract.fromSource(this.provider, 'token_bridge_for_chain.ral')
        this._tokenBridgeForChainContract = contract
        return contract
    }

    private async undoneSequenceContract(): Promise<Contract> {
        if (typeof this._undoneSequenceContract !== 'undefined') {
            return this._undoneSequenceContract as Contract
        }
        const contract = await Contract.fromSource(this.provider, 'undone_sequence.ral')
        this._undoneSequenceContract = contract
        return contract
    }

    async deployContracts(): Promise<WormholeContracts> {
        const eventEmitter = await this.deployEventEmitter()
        const undoneSequence = await this.undoneSequenceContract()
        const governanceDeployResult = await this.deployGovernance(
            undoneSequence.codeHash, eventEmitter.contractId, this.governanceChainId, this.governanceContractId,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            undoneSequence.codeHash, eventEmitter.contractId,  governanceDeployResult.contractId,
            this.tokenBridgeGovernanceChainId, this.tokenBridgeGovernanceContractId
        )
        const tokenWrapper = await this.tokenWrapperContract()
        return {
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            eventEmitter: eventEmitter,
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
        }
    }

    private async deployEventEmitter(): Promise<DeployResult> {
        const contract = await Contract.fromSource(this.provider, 'event_emitter.ral')
        return this._deploy(contract, {})
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
        const governance = await Contract.fromSource(this.provider, 'governance.ral')
        const previousGuardianSet = Array<string>(19).fill('')
        const initGuardianSetSize = initGuardianSet.length
        if (initGuardianSetSize > 19) {
            throw Error("init guardian set size larger than 19")
        }

        const currentGuardianSet = initGuardianSet.concat(Array(19 - initGuardianSetSize).fill(Byte32Zero))
        const initFields = {
            'chainId': CHAIN_ID_ALEPHIUM,
            'governanceChainId': governanceChainId,
            'governanceContract': governanceContractId,
            'next': 0,
            'next1': 0,
            'next2': 0,
            'undoneSequenceId': '',
            'messageFee': initMessageFee,
            'guardianSets': Array(previousGuardianSet, currentGuardianSet),
            'guardianSetIndexes': Array(0, initGuardianSetIndex),
            'guardianSetSizes': Array(0, initGuardianSet.length),
            'previousGuardianSetExpirationTime': 0,
            'undoneSequenceCodeHash': undoneSequenceCodeHash,
            'eventEmitterId': eventEmitterId
        }
        const governanceDeployResult = await this._deploy(governance, initFields)
        const undoneSequenceDeployResult = await this.deployUndoneSequence(governanceDeployResult.contractId)
        await this.innitUndoneSequence(governanceDeployResult.contractId, undoneSequenceDeployResult.contractId)
        return governanceDeployResult
    }

    private async deployTokenWrapperTemplate(): Promise<DeployResult> {
        const initFields = {
            'tokenBridgeId': '',
            'tokenBridgeForChainId': '',
            'localChainId': 0,
            'remoteChainId': 0,
            'tokenContractId': '',
            'isLocalToken': true,
            'symbol_': '',
            'name_': '',
            'decimals_': 0
        }
        const tokenWrapper = await this.tokenWrapperContract()
        return await this._deploy(tokenWrapper, initFields)
    }

    private async deployTokenBridgeForChainTemplate(): Promise<DeployResult> {
        const initFields = {
            'governanceId': '',
            'localChainId': 0,
            'localTokenBridgeId': '',
            'remoteChainId': 0,
            'remoteTokenBridgeId': '',
            'next': 0,
            'next1': 0,
            'next2': 0,
            'undoneSequenceId': '',
            'tokenWrapperTemplateId': '',
            'tokenWrapperCodeHash': '',
            'undoneSequenceCodeHash': '',
            'eventEmitterId': ''
        }
        const tokenBridgeForChain = await this.tokenBridgeForChainContract()
        return this._deploy(tokenBridgeForChain, initFields)
    }

    private async deployTokenBridge(
        undoneSequenceCodeHash: string,
        eventEmitterId: string,
        governanceId: string,
        governanceChainId: number,
        governanceContractId: string
    ): Promise<DeployResult> {
        const tokenWrapper = await this.tokenWrapperContract()
        const tokenWrapperDeployResult = await this.deployTokenWrapperTemplate()
        const tokenBridgeForChainDeployResult = await this.deployTokenBridgeForChainTemplate()

        const tokenBridge = await Contract.fromSource(this.provider, 'token_bridge.ral')
        const initFields = {
            'governanceId': governanceId,
            'governanceChainId': governanceChainId,
            'governanceContractId': governanceContractId,
            'next': 0,
            'next1': 0,
            'next2': 0,
            'undoneSequenceId': '',
            'localChainId': CHAIN_ID_ALEPHIUM,
            'sequence': 0,
            'tokenWrapperTemplateId': tokenWrapperDeployResult.contractId,
            'tokenBridgeForChainTemplateId': tokenBridgeForChainDeployResult.contractId,
            'tokenWrapperCodeHash': tokenWrapper.codeHash,
            'undoneSequenceCodeHash': undoneSequenceCodeHash,
            'eventEmitterId': eventEmitterId
        }
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
        const script = await Script.fromSource(this.provider, "register_chain.ral")
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
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
        const script = await Script.fromSource(this.provider, 'init_undone_sequence.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
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
        const script = await Script.fromSource(this.provider, 'create_local_wrapper.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
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
        const contract = await this.undoneSequenceContract()
        const initFields = {
            "owner": owner,
            "undone": '',
            "undoneSequenceMaxSize": undoneSequenceMaxSize,
            "undoneSequenceMaxDistance": undoneSequenceMaxDistance
        }
        return this._deploy(contract, initFields)
    }

    private async _deploy(contract: Contract, initFields: Fields): Promise<DeployResult> {
        const deployTx = await contract.transactionForDeployment(this.signer, {
            initialFields: initFields
        })
        const submitResult = await this.signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
        const confirmed = await waitTxConfirmed(this.provider, submitResult.txId)
        return {
            fromGroup: deployTx.fromGroup,
            toGroup: deployTx.toGroup,
            contractAddress: deployTx.contractAddress,
            contractId: deployTx.contractId,
            txId: submitResult.txId,
            blockHash: confirmed.blockHash
        }
    }
}
