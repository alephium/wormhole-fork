import { BuildScriptTx, CliqueClient, Contract, Number256, Script, Signer, SubmissionResult, Val } from 'alephium-web3'

const Byte32Zero = "0000000000000000000000000000000000000000000000000000000000000000"
const AlephiumChainId = 13

export interface DeployResult {
    groupIndex: number,
    address: string,
    txId: string,
}

export interface WormholeContracts {
    governance: DeployResult,
    tokenBridge: DeployResult,
    tokenWrapperFactory:DeployResult 
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

    private _tokenWrapperContract: any = null
    private _tokenBridgeForChainContract: any = null 
    private _undoneSequenceContract: any = null

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

    private async tokenWrapperContract(): Promise<Contract> {
        if (this._tokenWrapperContract) {
            return this._tokenWrapperContract as Contract
        }
        const contract = await this.getTokenWrapperContract()
        this._tokenWrapperContract = contract
        return contract
    }

    private async tokenBridgeForChainContract(tokenWrapperFactoryAddress: string): Promise<Contract> {
        if (this._tokenBridgeForChainContract) {
            return this._tokenBridgeForChainContract as Contract
        }
        const contract = await this.getTokenBridgeForChainContract(tokenWrapperFactoryAddress)
        this._tokenBridgeForChainContract = contract
        return contract
    }

    private async undoneSequenceContract(): Promise<Contract> {
        if (this._undoneSequenceContract) {
            return this._undoneSequenceContract as Contract
        }
        const contract = await this.getUndoneSequenceContract()
        this._undoneSequenceContract = contract
        return contract
    }

    private async undoneSequenceVariables() {
        const undoneSequence = await this.undoneSequenceContract()
        return {
            undoneSequenceCodeHash: undoneSequence.codeHash,
            undoneSequenceMaxSize: 128,
            undoneSequenceMaxDistance: 512
        }
    }

    private async tokenBridgeVariables(tokenWrapperFactoryAddress: string) {
        const tokenWrapper = await this.tokenWrapperContract()
        const tokenBridgeForChain = await this.tokenBridgeForChainContract(
            tokenWrapperFactoryAddress
        )
        return {
            tokenBridgeForChainBinCode: tokenBridgeForChain.bytecode,
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
            tokenWrapperBinCode: tokenWrapper.bytecode
        }
    }

    async deployContracts(): Promise<WormholeContracts> {
        const tokenWrapperFactoryDeployResult = await this.deployTokenWrapperFactory()
        const governanceDeployResult = await this.deployGovernance(
            this.governanceChainId, this.governanceContractId,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeDeployResult = await this.deployTokenBridge(
            tokenWrapperFactoryDeployResult.address, governanceDeployResult.address,
            this.tokenBridgeGovernanceChainId, this.tokenBridgeGovernanceContractId
        )
        return {
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
            tokenWrapperFactory: tokenWrapperFactoryDeployResult
        }
    }

    private async deployTokenWrapperFactory(): Promise<DeployResult> {
        const tokenWrapper = await this.tokenWrapperContract()
        const variables = {
            tokenWrapperBinCode: tokenWrapper.bytecode 
        }
        const tokenWrapperFactory = await Contract.from(this.client, 'token_wrapper_factory.ral', variables)
        return this._deploy(tokenWrapperFactory)
    }

    private async deployGovernance(
        governanceChainId: number,
        governanceContractId: string,
        initGuardianSet: string[],
        initGuardianSetIndex: number,
        initMessageFee: bigint
    ): Promise<DeployResult> {
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const governance = await Contract.from(this.client, 'governance.ral', undoneSequenceVars)
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
        const governanceDeployResult = await this._deploy(governance, initFields)
        const undoneSequenceDeployResult = await this.deployUndoneSequence(governanceDeployResult.address) 
        await this.innitUndoneSequence(governanceDeployResult.address, undoneSequenceDeployResult.address)
        return governanceDeployResult
    }

    private async deployTokenBridge(
        tokenWrapperFactoryAddress: string,
        governanceAddress: string,
        governanceChainId: number,
        governanceContractId: string
    ): Promise<DeployResult> {
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const tokenBridgeVars = await this.tokenBridgeVariables(tokenWrapperFactoryAddress)
        const variables = {
            ...tokenBridgeVars,
            ...undoneSequenceVars
        }
        const tokenBridge = await Contract.from(this.client, 'token_bridge.ral', variables)
        const initFields = [
            governanceAddress, governanceChainId, governanceContractId,
            0, 0, 0, '', AlephiumChainId, 0
        ]
        const tokenBridgeDeployResult = await this._deploy(tokenBridge, initFields)
        const undoneSequenceDeployResult = await this.deployUndoneSequence(tokenBridgeDeployResult.address) 
        await this.innitUndoneSequence(tokenBridgeDeployResult.address, undoneSequenceDeployResult.address)
        return tokenBridgeDeployResult
    }

    private emptyTokenBridgeVars = {
        tokenBridgeForChainBinCode: "",
        tokenWrapperCodeHash: "",
        tokenWrapperFactoryAddress: "",
        tokenWrapperBinCode: ""
    }

    async registerChainToAlph(
        tokenBridgeAddress: string,
        vaa: string,
        payer: string,
        amount: Number256,
        params?: BuildScriptTx,
    ): Promise<string> {
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const script = await Script.from(this.client, "register_chain.ral", {
            tokenBridgeAddress: tokenBridgeAddress,
            vaa: vaa,
            payer: payer,
            amount: amount,
            ...this.emptyTokenBridgeVars,
            ...undoneSequenceVars
        })
        const scriptTx = await script.transactionForDeployment(this.signer, params)
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return submitResult.txId
    }

    async initTokenBridgeForChain(tokenBridgeForChainAddress: string): Promise<SubmissionResult> {
        const undoneSequenceDeployResult = await this.deployUndoneSequence(tokenBridgeForChainAddress)
        return this.innitUndoneSequence(tokenBridgeForChainAddress, undoneSequenceDeployResult.address)
    }

    private async innitUndoneSequence(
        contractId: string,
        undoneSequenceId: string
    ): Promise<SubmissionResult> {
        const script = await Script.from(this.client, 'init_undone_sequence.ral', {
            contractId: contractId,
            undoneSequenceId: undoneSequenceId
        })
        const scriptTx = await script.transactionForDeployment(this.signer)
        return this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    }

    async createWrapperForLocalToken(
        tokenBridgeForChainAddress: string,
        localTokenId: string,
        payer: string,
        alphAmount: bigint
    ): Promise<string> {
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const script = await Script.from(this.client, 'create_local_wrapper.ral', {
            tokenBridgeForChainAddress: tokenBridgeForChainAddress,
            tokenId: localTokenId,
            payer: payer,
            alphAmount: alphAmount,
            ...this.emptyTokenBridgeVars,
            ...undoneSequenceVars
        })
        const scriptTx = await script.transactionForDeployment(this.signer)
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }

    private async deployUndoneSequence(owner: string): Promise<DeployResult> {
        const contract = await this.undoneSequenceContract()
        return this._deploy(contract, [owner, ''])
    }

    private async _deploy(
        contract: Contract,
        initFields?: Val[]
    ): Promise<DeployResult> {
        const deployTx = await contract.transactionForDeployment(this.signer, initFields)
        const submitResult = await this.signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
        return {
            groupIndex: deployTx.group,
            address: deployTx.contractAddress,
            txId: submitResult.txId
        }
    }

    private async getTokenBridgeForChainContract(
        tokenWrapperFactoryAddress: string
    ): Promise<Contract> {
        const tokenWrapper = await this.tokenWrapperContract()
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const variables = {
            tokenBridgeForChainBinCode: "",
            tokenWrapperCodeHash: tokenWrapper.codeHash,
            tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
            tokenWrapperBinCode: tokenWrapper.bytecode,
            ...undoneSequenceVars
        }
        return Contract.from(this.client, 'token_bridge_for_chain.ral', variables)
    }

    private async getTokenWrapperContract(): Promise<Contract> {
        const undoneSequenceVars = await this.undoneSequenceVariables()
        const variables = {
            ...this.emptyTokenBridgeVars,
            ...undoneSequenceVars
        }
        return Contract.from(this.client, 'token_wrapper.ral', variables)
    }

    private async getUndoneSequenceContract(
        undoneSequenceMaxSize: number = 128, // 1k
        undoneSequenceMaxDistance: number = 512
    ): Promise<Contract> {
        const variables = {
            undoneSequenceMaxSize: undoneSequenceMaxSize,
            undoneSequenceMaxDistance: undoneSequenceMaxDistance
        }
        return Contract.from(this.client, 'undone_sequence.ral', variables)
    }
}