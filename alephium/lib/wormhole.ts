import { NodeProvider, Contract, Number256, Script, SignerWithNodeProvider, Fields, addressFromContractId, subContractId } from '@alephium/web3'
import { waitTxConfirmed, zeroPad } from './utils'

const Byte32Zero = "0".repeat(64)
const DummyRefundAddress = addressFromContractId(Byte32Zero)
const MaxALPHValue = BigInt("1000000000") * BigInt("1000000000000000000")

export interface DeployResult {
    fromGroup: number
    toGroup: number
    contractAddress: string
    contractId: string
    txId: string
    blockHash: string
}

export interface WormholeContracts {
    remoteTokenPoolCodeHash: string
    wrappedAlph: DeployResult
    governance: DeployResult
    tokenBridge: DeployResult
}

export class Wormhole {
    provider: NodeProvider
    signer: SignerWithNodeProvider
    refundAddress: string
    localChainId: number
    governanceChainId: number
    governanceEmitterAddress: string
    initGuardianSet: string[]
    initGuardianSetIndex: number
    initMessageFee: bigint

    private _remoteTokenPool: Contract | undefined = undefined
    private _devnetDeployerId: string | undefined = undefined

    constructor(
        provider: NodeProvider,
        signer: SignerWithNodeProvider,
        refundAddress: string,
        localChainId: number,
        governanceChainId: number,
        governanceEmitterAddress: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ) {
        this.provider = provider
        this.signer = signer
        this.refundAddress = refundAddress
        this.localChainId = localChainId
        this.governanceChainId = governanceChainId
        this.governanceEmitterAddress = governanceEmitterAddress
        this.initGuardianSet = initGuardianSet
        this.initGuardianSetIndex = initGuardianSetIndex
        this.initMessageFee = initMessageFee
    }

    private async remotTokenPoolContract(): Promise<Contract> {
        if (typeof this._remoteTokenPool !== 'undefined') {
            return this._remoteTokenPool as Contract
        }
        const contract = await Contract.fromSource(this.provider, 'token_bridge/remote_token_pool.ral')
        this._remoteTokenPool = contract
        return contract
    }

    private async getDevnetDeployerId(): Promise<string> {
        if (typeof this._devnetDeployerId === 'undefined') {
            const devnetDeployerContract = await Contract.fromSource(this.provider, 'devnet/devnet_deployer.ral')
            const result = await this._deploy(devnetDeployerContract, {})
            this._devnetDeployerId = result.contractId
        }
        return this._devnetDeployerId
    }

    async deployContracts(devnet: boolean = false): Promise<WormholeContracts> {
        const governanceDeployResult = await this.deployGovernance(
            devnet, this.governanceChainId, this.governanceEmitterAddress,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const wrappedAlphDeployResult = await this.deployWrappedAlph(devnet)
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            devnet, governanceDeployResult.contractId, wrappedAlphDeployResult.contractId
        )
        const remoteTokenPool = await this.remotTokenPoolContract()
        return {
            remoteTokenPoolCodeHash: remoteTokenPool.codeHash,
            wrappedAlph: wrappedAlphDeployResult,
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
        }
    }

    private async deployGovernance(
        devnet: boolean,
        governanceChainId: number,
        governanceEmitterAddress: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ): Promise<DeployResult> {
        const governance = await Contract.fromSource(this.provider, 'governance.ral')
        const sizePrefix = zeroPad(initGuardianSet.length.toString(16), 1)
        const currentGuardianSet = sizePrefix + initGuardianSet.join('')
        const initFields = {
            'chainId': this.localChainId,
            'governanceChainId': governanceChainId,
            'governanceEmitterAddress': governanceEmitterAddress,
            'receivedSequence': 0,
            'messageFee': initMessageFee,
            'previousGuardianSetExpirationTime': 0
        }
        if (devnet) {
            const fields = {
                'guardianSet0': '',
                'guardianSet1': currentGuardianSet,
                'guardianSetIndex0': 0,
                'guardianSetIndex1': initGuardianSetIndex,
                ...initFields
            }
            return this.deployOnDevnet(governance, 'deploy_governance.ral', fields, '00')
        } else {
            return this._deploy(governance, {
                'guardianSets': Array('', currentGuardianSet),
                'guardianSetIndexes': Array(0, initGuardianSetIndex),
                ...initFields
            })
        }
    }

    private async deployUndoneSequenceTemplate(): Promise<DeployResult> {
        const initFields = {
            'parentId': '',
            'begin': 0,
            'sequences': 0n,
            'refundAddress': DummyRefundAddress
        }
        const undoneSequence = await Contract.fromSource(this.provider, 'sequence/undone_sequence.ral')
        return await this._deploy(undoneSequence, initFields)
    }

    private async deployWrappedAlphTokenPoolTemplate(): Promise<DeployResult> {
        const initFields = {
            'tokenBridgeId': '',
            'tokenChainId': 0,
            'bridgeTokenId': '',
            'totalBridged': 0,
            'decimals_': 0
        }
        const tokenPool = await Contract.fromSource(this.provider, 'token_bridge/wrapped_alph_pool.ral')
        return await this._deploy(tokenPool, initFields)
    }

    private async deployLocalTokenPoolTemplate(): Promise<DeployResult> {
        const initFields = {
            'tokenBridgeId': '',
            'tokenChainId': 0,
            'bridgeTokenId': '',
            'totalBridged': 0,
            'decimals_': 0
        }
        const tokenPool = await Contract.fromSource(this.provider, 'token_bridge/local_token_pool.ral')
        return await this._deploy(tokenPool, initFields)
    }

    private async deployRemoteTokenPoolTemplate(): Promise<DeployResult> {
        const initFields = {
            'tokenBridgeId': '',
            'tokenChainId': 0,
            'bridgeTokenId': '',
            'totalBridged': 0,
            'symbol_': '',
            'name_': '',
            'decimals_': 0
        }
        const tokenPool = await this.remotTokenPoolContract()
        return await this._deploy(tokenPool, initFields)
    }

    private async deployTokenBridgeForChainTemplate(): Promise<DeployResult> {
        const initFields = {
            'governanceContractId': '',
            'localChainId': 0,
            'localTokenBridgeId': '',
            'remoteChainId': 0,
            'remoteTokenBridgeId': '',
            'next': 0,
            'next1': 0,
            'next2': 0,
            'undoneSequenceTemplateId': '',
            'refundAddress': DummyRefundAddress,
            'sendSequence': 0
        }
        const tokenBridgeForChain = await Contract.fromSource(this.provider, 'token_bridge/token_bridge_for_chain.ral')
        return this._deploy(tokenBridgeForChain, initFields)
    }

    private async deployAttestTokenHandlerTemplate(): Promise<DeployResult> {
        const initFields = {
            'governanceContractId': '',
            'localChainId': 0,
            'localTokenBridgeId': '',
            'remoteChainId': 0,
            'remoteTokenBridgeId': '',
            'receivedSequence': 0
        }
        const attestTokenHandler = await Contract.fromSource(this.provider, 'token_bridge/attest_token_handler.ral')
        return this._deploy(attestTokenHandler, initFields)
    }

    private async deployOnDevnet(
        contract: Contract,
        scriptFileName: string,
        initFields: Fields,
        path: string
    ): Promise<DeployResult> {
        const deployerId = await this.getDevnetDeployerId()
        const script = await Script.fromSource(this.provider, `devnet/${scriptFileName}`)
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                'deployerId': deployerId,
                'bytecode': contract.bytecode,
                ...initFields
            }
        })
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        const confirmed = await waitTxConfirmed(this.provider, submitResult.txId)
        const contractId = subContractId(deployerId, path)
        return {
            fromGroup: scriptTx.fromGroup,
            toGroup: scriptTx.toGroup,
            contractAddress: addressFromContractId(contractId),
            contractId: contractId,
            txId: submitResult.txId,
            blockHash: confirmed.blockHash
        }
    }

    private async deployWrappedAlph(devnet: boolean): Promise<DeployResult> {
        const initFields = {'totalWrapped': 0}
        const wrappedAlph = await Contract.fromSource(this.provider, 'token_bridge/wrapped_alph.ral')
        if (devnet) {
            return this.deployOnDevnet(wrappedAlph, 'deploy_wrapped_alph.ral', initFields, '02')
        } else {
            return this._deploy(wrappedAlph, initFields, MaxALPHValue)
        }
    }

    private async deployTokenBridge(
        devnet: boolean,
        governanceContractId: string,
        wrappedAlphId: string
    ): Promise<DeployResult> {
        const wrappedAlphPool = await this.deployWrappedAlphTokenPoolTemplate()
        const localTokenPool = await this.deployLocalTokenPoolTemplate()
        const remoteTokenPool = await this.deployRemoteTokenPoolTemplate()
        const tokenBridgeForChainDeployResult = await this.deployTokenBridgeForChainTemplate()
        const attestTokenHandlerDeployResult = await this.deployAttestTokenHandlerTemplate()
        const undoneSequenceDeployResult = await this.deployUndoneSequenceTemplate()
        const tokenBridge = await Contract.fromSource(this.provider, 'token_bridge/token_bridge.ral')
        const initFields = {
            'governanceContractId': governanceContractId,
            'localChainId': this.localChainId,
            'receivedSequence': 0,
            'sendSequence': 0,
            'wrappedAlphId': wrappedAlphId,
            'wrappedAlphPoolTemplateId': wrappedAlphPool.contractId,
            'localTokenPoolTemplateId': localTokenPool.contractId,
            'remoteTokenPoolTemplateId': remoteTokenPool.contractId,
            'tokenBridgeForChainTemplateId': tokenBridgeForChainDeployResult.contractId,
            'attestTokenHandlerTemplateId': attestTokenHandlerDeployResult.contractId,
            'undoneSequenceTemplateId': undoneSequenceDeployResult.contractId,
            'refundAddress': this.refundAddress
        }
        if (devnet) {
            return this.deployOnDevnet(tokenBridge, 'deploy_token_bridge.ral', initFields, '01')
        } else {
            return this._deploy(tokenBridge, initFields)
        }
    }

    async registerChainToAlph(
        tokenBridgeId: string,
        vaa: string,
        payer: string,
        alphAmount: Number256
    ): Promise<string> {
        const script = await Script.fromSource(this.provider, "token_bridge_scripts/register_chain.ral")
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

    async createLocalTokenPool(
        tokenBridgeId: string,
        localTokenId: string,
        payer: string,
        alphAmount: bigint
    ): Promise<string> {
        const script = await Script.fromSource(this.provider, 'token_bridge_scripts/create_local_token_pool.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                tokenBridgeId: tokenBridgeId,
                localTokenId: localTokenId,
                payer: payer,
                alphAmount: alphAmount
            },
            tokens: [{
                id: localTokenId,
                amount: 1
            }]
        })
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }

    async createWrappedAlphPool(tokenBridgeId: string, payer: string, alphAmount: bigint): Promise<string> {
        const script = await Script.fromSource(this.provider, 'token_bridge_scripts/create_wrapped_alph_pool.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                tokenBridgeId: tokenBridgeId,
                payer: payer,
                alphAmount: alphAmount
            }
        })
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }

    private async _deploy(contract: Contract, initFields: Fields, issueTokenAmount?: bigint): Promise<DeployResult> {
        const deployTx = await contract.transactionForDeployment(this.signer, {
            initialFields: initFields,
            issueTokenAmount: issueTokenAmount
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
