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

    async deployContracts(): Promise<WormholeContracts> {
        const tokenWrapper = await tokenWrapperContract(this.client)
        const tokenWrapperFactoryDeployResult = await deployTokenWrapperFactory(
            this.client, this.signer, tokenWrapper.bytecode
        )
        const governanceDeployResult = await deployGovernance(
            this.client, this.signer, this.governanceChainId, this.governanceContractId,
            this.initGuardianSet, this.initGuardianSetIndex, this.initMessageFee
        )
        const tokenBridgeForChain = await tokenBridgeForChainContract(
            this.client, tokenWrapperFactoryDeployResult.address, tokenWrapper.codeHash)
        const tokenBridgeDeployResult = await deployTokenBridge(
            this.client, this.signer, governanceDeployResult.address,
            this.tokenBridgeGovernanceChainId, this.tokenBridgeGovernanceContractId,
            tokenBridgeForChain.bytecode, tokenWrapper.codeHash
        )
        return {
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
            tokenWrapperFactory: tokenWrapperFactoryDeployResult
        }
    }

    async registerChainToAlph(
        tokenBridgeAddress: string,
        vaa: string,
        payer: string,
        amount: Number256,
        params?: BuildScriptTx,
    ): Promise<string> {
        const script = await Script.from(this.client, "register_chain.ral", {
            tokenBridgeAddress: tokenBridgeAddress,
            vaa: vaa,
            payer: payer,
            amount: amount,
            tokenWrapperFactoryAddress: "",
            tokenBridgeForChainBinCode: "",
            tokenWrapperCodeHash: "",
            tokenWrapperBinCode: '',
            undoneSequenceCodeHash: "",
            undoneSequenceMaxSize: 128,
            undoneSequenceMaxDistance: 512
        })
        const scriptTx = await script.transactionForDeployment(this.signer, params)
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return submitResult.txId
    }

    async initTokenBridgeForChain(tokenBridgeForChainAddress: string): Promise<SubmissionResult> {
        const undoneSequenceDeployResult = await deployUndoneSequence(this.client, this.signer, tokenBridgeForChainAddress)
        return innitUndoneSequence(this.client, this.signer, tokenBridgeForChainAddress, undoneSequenceDeployResult.address)
    }

    async createWrapperForLocalToken(
        tokenBridgeForChainAddress: string,
        localTokenId: string,
        payer: string,
        alphAmount: bigint
    ): Promise<string> {
        const script = await Script.from(this.client, 'create_local_wrapper.ral', {
            tokenBridgeForChainAddress: tokenBridgeForChainAddress,
            tokenId: localTokenId,
            payer: payer,
            alphAmount: alphAmount,
            tokenWrapperFactoryAddress: "",
            tokenWrapperCodeHash: "",
            tokenWrapperBinCode: "",
            tokenBridgeForChainBinCode: "",
            undoneSequenceCodeHash: "",
            undoneSequenceMaxSize: 128,
            undoneSequenceMaxDistance: 512
        })
        const scriptTx = await script.transactionForDeployment(this.signer)
        const result = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return result.txId
    }
}

async function _deploy(
    signer: Signer,
    contract: Contract,
    initFields?: Val[]
): Promise<DeployResult> {
    const deployTx = await contract.transactionForDeployment(signer, initFields)
    const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
    return {
        groupIndex: deployTx.group,
        address: deployTx.contractAddress,
        txId: submitResult.txId
    }
}

async function deployUndoneSequence(
    client: CliqueClient,
    signer: Signer,
    owner: string,
    undoneSequenceMaxSize: number = 128, // 1k
    undoneSequenceMaxDistance: number = 512
): Promise<DeployResult> {
    const contract = await undoneSequenceContract(
        client, undoneSequenceMaxSize, undoneSequenceMaxDistance
    )
    return _deploy(signer, contract, [owner, ''])
}

async function deployGovernance(
    client: CliqueClient,
    signer: Signer,
    governanceChainId: number,
    governanceContractId: string,
    initGuardianSet: string[],
    initGuardianSetIndex: number,
    initMessageFee: bigint
): Promise<DeployResult> {
    const undoneSequence = await undoneSequenceContract(client)
    const governance = await Contract.from(client, 'governance.ral', {
        undoneSequenceCodeHash: undoneSequence.codeHash,
        undoneSequenceMaxSize: 128,
        undoneSequenceMaxDistance: 512
    })
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
    const governanceDeployResult = await _deploy(signer, governance, initFields)
    const undoneSequenceDeployResult = await deployUndoneSequence(client, signer, governanceDeployResult.address) 
    await innitUndoneSequence(client, signer, governanceDeployResult.address, undoneSequenceDeployResult.address)
    return governanceDeployResult
}

async function innitUndoneSequence(
    client: CliqueClient,
    signer: Signer,
    contractId: string,
    undoneSequenceId: string
): Promise<SubmissionResult> {
    const script = await Script.from(client, 'init_undone_sequence.ral', {
        contractId: contractId,
        undoneSequenceId: undoneSequenceId
    })
    const scriptTx = await script.transactionForDeployment(signer)
    return signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
}

async function deployTokenWrapperFactory(
    client: CliqueClient,
    signer: Signer,
    tokenWrapperBinCode: string
): Promise<DeployResult> {
    const variables = {
        tokenWrapperBinCode: tokenWrapperBinCode
    }
    const tokenWrapperFactory = await Contract.from(client, 'token_wrapper_factory.ral', variables)
    return _deploy(signer, tokenWrapperFactory)
}

async function deployTokenBridge(
    client: CliqueClient,
    signer: Signer,
    governanceAddress: string,
    governanceChainId: number,
    governanceContractId: string,
    tokenBridgeForChainBinCode: string,
    tokenWrapperCodeHash: string
): Promise<DeployResult> {
    const undoneSequence = await undoneSequenceContract(client)
    const variables = {
        tokenBridgeForChainBinCode: tokenBridgeForChainBinCode,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperFactoryAddress: "",
        tokenWrapperBinCode: '',
        undoneSequenceCodeHash: undoneSequence.codeHash,
        undoneSequenceMaxSize: 128,
        undoneSequenceMaxDistance: 512
    }
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', variables)
    const initFields = [
        governanceAddress, governanceChainId, governanceContractId,
        0, 0, 0, '', AlephiumChainId, 0
    ]
    const tokenBridgeDeployResult = await _deploy(signer, tokenBridge, initFields)
    const undoneSequenceDeployResult = await deployUndoneSequence(client, signer, tokenBridgeDeployResult.address) 
    await innitUndoneSequence(client, signer, tokenBridgeDeployResult.address, undoneSequenceDeployResult.address)
    return tokenBridgeDeployResult
}

async function tokenBridgeForChainContract(
    client: CliqueClient,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string
): Promise<Contract> {
    const undoneSequence = await undoneSequenceContract(client)
    const variables = {
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperBinCode: "",
        tokenBridgeForChainBinCode: "",
        undoneSequenceCodeHash: undoneSequence.codeHash,
        undoneSequenceMaxSize: 128,
        undoneSequenceMaxDistance: 512
    }
    return Contract.from(client, 'token_bridge_for_chain.ral', variables)
}

async function tokenWrapperContract(client: CliqueClient): Promise<Contract> {
    const variables = {
        tokenBridgeForChainBinCode: "",
        tokenWrapperBinCode: "",
        tokenWrapperCodeHash: "",
        tokenWrapperFactoryAddress: "",
        undoneSequenceCodeHash: "",
        undoneSequenceMaxSize: 128,
        undoneSequenceMaxDistance: 512
    }
    return Contract.from(client, 'token_wrapper.ral', variables)
}

async function undoneSequenceContract(
    client: CliqueClient,
    undoneSequenceMaxSize: number = 128, // 1k
    undoneSequenceMaxDistance: number = 512
): Promise<Contract> {
    const variables = {
        undoneSequenceMaxSize: undoneSequenceMaxSize,
        undoneSequenceMaxDistance: undoneSequenceMaxDistance
    }
    return Contract.from(client, 'undone_sequence.ral', variables)
}
