import { BuildScriptTx, CliqueClient, Contract, Number256, Script, Signer, Val } from 'alephium-web3'

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
            tokenBridgeForChainBinCode: "",
            tokenWrapperCodeHash: "",
            distance: 64
        })
        const scriptTx = await script.transactionForDeployment(this.signer, params)
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return submitResult.txId
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
            distance: 64
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

async function deployGovernance(
    client: CliqueClient,
    signer: Signer,
    governanceChainId: number,
    governanceContractId: string,
    initGuardianSet: string[],
    initGuardianSetIndex: number,
    initMessageFee: bigint
): Promise<DeployResult> {
    const governance = await Contract.from(client, 'governance.ral', { distance: 64 })
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
    return await _deploy(signer, governance, initFields)
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
    const variables = {
        tokenBridgeForChainBinCode: tokenBridgeForChainBinCode,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        distance: 64
    }
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', variables)
    const initFields = [
        governanceAddress, governanceChainId, governanceContractId,
        0, 0, 0, '', AlephiumChainId, 0
    ]
    return await _deploy(signer, tokenBridge, initFields)
}

async function tokenBridgeForChainContract(
    client: CliqueClient,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string
): Promise<Contract> {
    const variables = {
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        distance: 64,
        tokenWrapperBinCode: "",
        tokenBridgeForChainBinCode: ""
    }
    return Contract.from(client, 'token_bridge_for_chain.ral', variables)
}

async function tokenWrapperContract(client: CliqueClient): Promise<Contract> {
    const variables = {
        tokenBridgeForChainBinCode: "",
        tokenWrapperBinCode: "",
        tokenWrapperCodeHash: "",
        tokenWrapperFactoryAddress: "",
        distance: 64
    }
    return Contract.from(client, 'token_wrapper.ral', variables)
}
