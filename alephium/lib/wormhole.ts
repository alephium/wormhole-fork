import { NodeProvider, Contract, Number256, Script, SignerWithNodeProvider, Fields } from '@alephium/web3'
import { toContractAddress, waitTxConfirmed } from './utils'

const Byte32Zero = "0000000000000000000000000000000000000000000000000000000000000000"
const DummyRefundAddress = toContractAddress(Byte32Zero)

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
    governance: DeployResult
    tokenBridge: DeployResult
}

export class Wormhole {
    provider: NodeProvider
    signer: SignerWithNodeProvider
    refundAddress: string
    localChainId: number
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
        refundAddress: string,
        localChainId: number,
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
        this.refundAddress = refundAddress
        this.localChainId = localChainId
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
        const governanceDeployResult = await this.deployGovernance(
            this.governanceChainId, this.governanceContractId, this.initGuardianSet,
            this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            governanceDeployResult.contractId,
            this.tokenBridgeGovernanceChainId,
            this.tokenBridgeGovernanceContractId
        )
        const tokenWrapper = await this.tokenWrapperContract()
        return {
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
        }
    }

    private async deployGovernance(
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
            'chainId': this.localChainId,
            'governanceChainId': governanceChainId,
            'governanceContract': governanceContractId,
            'receivedSequence': 0,
            'messageFee': initMessageFee,
            'guardianSets': Array(previousGuardianSet, currentGuardianSet),
            'guardianSetIndexes': Array(0, initGuardianSetIndex),
            'guardianSetSizes': Array(0, initGuardianSet.length),
            'previousGuardianSetExpirationTime': 0
        }
        return await this._deploy(governance, initFields)
    }

    private async deployUndoneSequenceTemplate(): Promise<DeployResult> {
        const initFields = {
            'parentId': '',
            'begin': 0,
            'sequences': 0n,
            'refundAddress': DummyRefundAddress
        }
        const undoneSequence = await this.undoneSequenceContract()
        return await this._deploy(undoneSequence, initFields)
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
            'undoneSequenceTemplateId': '',
            'tokenWrapperTemplateId': '',
            'tokenWrapperCodeHash': '',
            'refundAddress': DummyRefundAddress
        }
        const tokenBridgeForChain = await this.tokenBridgeForChainContract()
        return this._deploy(tokenBridgeForChain, initFields)
    }

    private async deployTokenBridge(
        governanceId: string,
        governanceChainId: number,
        governanceContractId: string
    ): Promise<DeployResult> {
        const tokenWrapper = await this.tokenWrapperContract()
        const tokenWrapperDeployResult = await this.deployTokenWrapperTemplate()
        const tokenBridgeForChainDeployResult = await this.deployTokenBridgeForChainTemplate()
        const undoneSequenceDeployResult = await this.deployUndoneSequenceTemplate()
        const tokenBridge = await Contract.fromSource(this.provider, 'token_bridge.ral')
        const initFields = {
            'governanceId': governanceId,
            'governanceChainId': governanceChainId,
            'governanceContractId': governanceContractId,
            'localChainId': this.localChainId,
            'receivedSequence': 0,
            'sendSequence': 0,
            'tokenWrapperCodeHash': tokenWrapper.codeHash,
            'tokenWrapperTemplateId': tokenWrapperDeployResult.contractId,
            'tokenBridgeForChainTemplateId': tokenBridgeForChainDeployResult.contractId,
            'undoneSequenceTemplateId': undoneSequenceDeployResult.contractId,
            'refundAddress': this.refundAddress
        }
        return await this._deploy(tokenBridge, initFields)
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
