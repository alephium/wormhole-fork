import {
    NodeProvider,
    Contract,
    Number256,
    SignerWithNodeProvider,
    Fields,
    addressFromContractId,
    subContractId,
    Project
} from '@alephium/web3'
import { waitTxConfirmed, zeroPad } from './utils'

const Byte32Zero = "0".repeat(64)
const DummyRefundAddress = addressFromContractId(Byte32Zero)
const MaxALPHValue = BigInt("1000000000") * BigInt("1000000000000000000")

export type NetworkType = "mainnet" | "testnet" | "devnet"

interface NetworkConfigs {
    minimalConsistencyLevel: number
}

// TODO: update this once we release the SDK
const networkConfigs: Record<NetworkType, NetworkConfigs> = {
    "mainnet": {
        minimalConsistencyLevel: 105
    },
    "testnet": {
        minimalConsistencyLevel: 10
    },
    "devnet": {
        minimalConsistencyLevel: 10
    }
}

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

    private remoteTokenPoolContract(): Contract {
        if (typeof this._remoteTokenPool !== 'undefined') {
            return this._remoteTokenPool as Contract
        }
        const contract = Project.contract('token_bridge/remote_token_pool.ral')
        this._remoteTokenPool = contract
        return contract
    }

    private async getDevnetDeployerId(): Promise<string> {
        if (typeof this._devnetDeployerId === 'undefined') {
            const devnetDeployerContract = Project.contract('devnet/devnet_deployer.ral')
            const result = await this._deploy(devnetDeployerContract, {})
            this._devnetDeployerId = result.contractId
        }
        return this._devnetDeployerId
    }

    async deployContracts(networkType: NetworkType): Promise<WormholeContracts> {
        const governanceDeployResult = await this.deployGovernance(networkType)
        const wrappedAlphDeployResult = await this.deployWrappedAlph(networkType)
        const tokenBridgeFactoryDeployResult = await this.deployTokenBridgeFactory()
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            networkType,
            governanceDeployResult.contractId,
            wrappedAlphDeployResult.contractId,
            tokenBridgeFactoryDeployResult.contractId
        )
        const remoteTokenPool = this.remoteTokenPoolContract()
        return {
            remoteTokenPoolCodeHash: remoteTokenPool.codeHash,
            wrappedAlph: wrappedAlphDeployResult,
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
        }
    }

    private async deployGovernance(networkType: NetworkType): Promise<DeployResult> {
        const governance = Project.contract('governance.ral')
        const sizePrefix = zeroPad(this.initGuardianSet.length.toString(16), 1)
        const currentGuardianSet = sizePrefix + this.initGuardianSet.join('')
        const initFields = {
            'chainId': this.localChainId,
            'governanceChainId': this.governanceChainId,
            'governanceEmitterAddress': this.governanceEmitterAddress,
            'receivedSequence': 0,
            'messageFee': this.initMessageFee,
            'previousGuardianSetExpirationTimeMS': 0
        }
        if (networkType === "devnet") {
            const fields = {
                'guardianSet0': '',
                'guardianSet1': currentGuardianSet,
                'guardianSetIndex0': 0,
                'guardianSetIndex1': this.initGuardianSetIndex,
                ...initFields
            }
            return this.deployOnDevnet(governance, 'deploy_governance.ral', fields, '00')
        } else {
            return this._deploy(governance, {
                'guardianSets': Array('', currentGuardianSet),
                'guardianSetIndexes': Array(0, this.initGuardianSetIndex),
                ...initFields
            })
        }
    }

    private async deployTokenBridgeFactory(): Promise<DeployResult> {
        const wrappedAlphPool = await this.deployWrappedAlphTokenPoolTemplate()
        const localTokenPool = await this.deployLocalTokenPoolTemplate()
        const remoteTokenPool = await this.deployRemoteTokenPoolTemplate()
        const tokenBridgeForChainDeployResult = await this.deployTokenBridgeForChainTemplate()
        const attestTokenHandlerDeployResult = await this.deployAttestTokenHandlerTemplate()
        const unExecutedSequenceDeployResult = await this.deployUnExecutedSequenceTemplate()
        const tokenBridgeFactory = Project.contract('token_bridge/token_bridge_factory.ral')
        const initFields = {
            'wrappedAlphPoolTemplateId': wrappedAlphPool.contractId,
            'localTokenPoolTemplateId': localTokenPool.contractId,
            'remoteTokenPoolTemplateId': remoteTokenPool.contractId,
            'tokenBridgeForChainTemplateId': tokenBridgeForChainDeployResult.contractId,
            'attestTokenHandlerTemplateId': attestTokenHandlerDeployResult.contractId,
            'unExecutedSequenceTemplateId': unExecutedSequenceDeployResult.contractId,
            'refundAddress': this.refundAddress
        }
        return this._deploy(tokenBridgeFactory, initFields)
    }

    private async deployUnExecutedSequenceTemplate(): Promise<DeployResult> {
        const initFields = {
            'parentId': '',
            'begin': 0,
            'sequences': 0n,
            'refundAddress': DummyRefundAddress
        }
        const unExecutedSequence = Project.contract('sequence/unexecuted_sequence.ral')
        return await this._deploy(unExecutedSequence, initFields)
    }

    private async deployWrappedAlphTokenPoolTemplate(): Promise<DeployResult> {
        const initFields = {
            'tokenBridgeId': '',
            'tokenChainId': 0,
            'bridgeTokenId': '',
            'totalBridged': 0,
            'decimals_': 0
        }
        const tokenPool = Project.contract('token_bridge/wrapped_alph_pool.ral')
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
        const tokenPool = Project.contract('token_bridge/local_token_pool.ral')
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
        const tokenPool = this.remoteTokenPoolContract()
        return await this._deploy(tokenPool, initFields)
    }

    private async deployTokenBridgeForChainTemplate(): Promise<DeployResult> {
        const initFields = {
            'governance': '',
            'localChainId': 0,
            'localTokenBridgeId': '',
            'remoteChainId': 0,
            'remoteTokenBridgeId': '',
            'next': 0,
            'next1': 0,
            'next2': 0,
            'unExecutedSequenceTemplateId': '',
            'refundAddress': DummyRefundAddress,
            'sendSequence': 0
        }
        const tokenBridgeForChain = Project.contract('token_bridge/token_bridge_for_chain.ral')
        return this._deploy(tokenBridgeForChain, initFields)
    }

    private async deployAttestTokenHandlerTemplate(): Promise<DeployResult> {
        const initFields = {
            'governance': '',
            'localChainId': 0,
            'localTokenBridge': '',
            'remoteChainId': 0,
            'remoteTokenBridgeId': '',
            'receivedSequence': 0
        }
        const attestTokenHandler = Project.contract('token_bridge/attest_token_handler.ral')
        return this._deploy(attestTokenHandler, initFields)
    }

    private async deployOnDevnet(
        contract: Contract,
        scriptFileName: string,
        initFields: Fields,
        path: string
    ): Promise<DeployResult> {
        const deployerId = await this.getDevnetDeployerId()
        const script = Project.script(`devnet/${scriptFileName}`)
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                'deployer': deployerId,
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

    private async deployWrappedAlph(networkType: NetworkType): Promise<DeployResult> {
        const initFields = {'totalWrapped': 0}
        const wrappedAlph = Project.contract('token_bridge/wrapped_alph.ral')
        if (networkType === "devnet") {
            return this.deployOnDevnet(wrappedAlph, 'deploy_wrapped_alph.ral', initFields, '02')
        } else {
            return this._deploy(wrappedAlph, initFields, MaxALPHValue)
        }
    }

    private async deployTokenBridge(
        networkType: NetworkType,
        governanceContractId: string,
        wrappedAlphId: string,
        tokenBridgeFactoryId: string
    ): Promise<DeployResult> {
        const tokenBridge = Project.contract('token_bridge/token_bridge.ral')
        const initFields = {
            'governance': governanceContractId,
            'localChainId': this.localChainId,
            'receivedSequence': 0,
            'sendSequence': 0,
            'wrappedAlphId': wrappedAlphId,
            'tokenBridgeFactory': tokenBridgeFactoryId,
            'minimalConsistencyLevel': networkConfigs[networkType].minimalConsistencyLevel
        }
        if (networkType === "devnet") {
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
        const script = Project.script("token_bridge_scripts/register_chain.ral")
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                payer: payer,
                tokenBridge: tokenBridgeId,
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
        const script = Project.script('token_bridge_scripts/create_local_token_pool.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                tokenBridge: tokenBridgeId,
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
        const script = Project.script('token_bridge_scripts/create_wrapped_alph_pool.ral')
        const scriptTx = await script.transactionForDeployment(this.signer, {
            initialFields: {
                tokenBridge: tokenBridgeId,
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
