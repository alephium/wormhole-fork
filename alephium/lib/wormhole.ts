import { BuildScriptTx, CliqueClient, Contract, Number256, Script, Signer, Val } from 'alephium-js'

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
        const serdeDeployResult = await deploySerde(this.client, this.signer)
        const tokenWrapper = await tokenWrapperContract(this.client)
        const tokenWrapperFactoryDeployResult = await deployTokenWrapperFactory(
            this.client, this.signer, serdeDeployResult.address, tokenWrapper.bytecode
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
            serdeDeployResult.address, tokenBridgeForChain.bytecode, tokenBridgeForChain.codeHash,
            tokenWrapper.codeHash
        )
        return {
            governance: governanceDeployResult,
            tokenBridge: tokenBridgeDeployResult,
            tokenWrapperFactory: tokenWrapperFactoryDeployResult
        }
    }

    async initTokenBridgeForChain(tokenBridgeForChainAddress: string): Promise<string> {
        const sequenceDeployResult = await deploySequence(this.client, this.signer, tokenBridgeForChainAddress)
        const initScript = await Script.from(this.client, "token_bridge_for_chain_init.ral", {
            tokenBridgeForChainAddress: tokenBridgeForChainAddress,
            sequenceAddress: sequenceDeployResult.address,
            serdeAddress: "00",
            tokenBridgeForChainBinCode: "00",
            tokenBridgeForChainCodeHash: "00",
            tokenWrapperBinCode: "00",
            tokenWrapperCodeHash: "00",
        })
        const initScriptTx = await initScript.transactionForDeployment(this.signer)
        const submitResult = await this.signer.submitTransaction(initScriptTx.unsignedTx, initScriptTx.txId)
        return submitResult.txId
    }

    async registerChainToAlph(
        tokenBridgeAddress: string,
        vaa: string,
        payer: string,
        amount: Number256,
        params: BuildScriptTx,
    ): Promise<string> {
        const script = await Script.from(this.client, "register_chain.ral", {
            tokenBridgeAddress: tokenBridgeAddress,
            vaa: vaa,
            payer: payer,
            amount: amount,
            serdeAddress: "00",
            tokenBridgeForChainBinCode: "00",
            tokenBridgeForChainCodeHash: "00",
            tokenWrapperCodeHash: "00",
        })
        const scriptTx = await script.transactionForDeployment(this.signer, params)
        const submitResult = await this.signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
        return submitResult.txId
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

export async function deploySequence(
    client: CliqueClient,
    signer: Signer,
    owner: string
): Promise<DeployResult> {
    const sequence = await Contract.from(client, 'sequence.ral')
    const next1 = Array(20).fill(0)
    const next2 = Array(20).fill(0)
    const initFields = [owner, 0, next1, next2]
    return _deploy(signer, sequence, initFields)
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
    const governance = await Contract.from(client, 'governance.ral')
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
        AlephiumChainId, governanceChainId, governanceContractId, false, Byte32Zero, initMessageFee,
        initGuardianSets, initGuardianIndexes, initGuardianSizes, previousGuardianSetExpirationTime
    ]

    const governanceDeployResult = await _deploy(signer, governance, initFields)
    const sequenceDeployResult = await deploySequence(client, signer, governanceDeployResult.address)
    const initScript = await Script.from(client, 'governance_init.ral', {
        governanceAddress: governanceDeployResult.address,
        sequenceAddress: sequenceDeployResult.address
    })
    const initScriptTx = await initScript.transactionForDeployment(signer)
    await signer.submitTransaction(initScriptTx.unsignedTx, initScriptTx.txId)
    return governanceDeployResult
}

async function deploySerde(
    client: CliqueClient,
    signer: Signer
): Promise<DeployResult> {
    const serde = await Contract.from(client, 'serde.ral')
    return _deploy(signer, serde)
}

async function deployTokenWrapperFactory(
    client: CliqueClient,
    signer: Signer,
    serdeAddress: string,
    tokenWrapperBinCode: string
): Promise<DeployResult> {
    const variables = {
        serdeAddress: serdeAddress,
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
    serdeAddress: string,
    tokenBridgeForChainBinCode: string,
    tokenBridgeForChainCodeHash: string,
    tokenWrapperCodeHash: string
): Promise<DeployResult> {
    const variables = {
        serdeAddress: serdeAddress,
        tokenBridgeForChainBinCode: tokenBridgeForChainBinCode,
        tokenBridgeForChainCodeHash: tokenBridgeForChainCodeHash,
        tokenWrapperCodeHash: tokenWrapperCodeHash
    }
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', variables)
    const initFields = [
        governanceAddress, governanceChainId, governanceContractId, false, Byte32Zero, AlephiumChainId, 0
    ]

    const tokenBridgeDeployResult = await _deploy(signer, tokenBridge, initFields)
    const sequenceDeployResult = await deploySequence(client, signer, tokenBridgeDeployResult.address)
    const initScript = await Script.from(client, 'token_bridge_init.ral', {
        tokenBridgeAddress: tokenBridgeDeployResult.address,
        sequenceAddress: sequenceDeployResult.address,
        serdeAddress: "00",
        tokenBridgeForChainBinCode: "00",
        tokenBridgeForChainCodeHash: "00",
        tokenWrapperCodeHash: "00",
    })
    const initScriptTx = await initScript.transactionForDeployment(signer)
    await signer.submitTransaction(initScriptTx.unsignedTx, initScriptTx.txId)
    return tokenBridgeDeployResult
}

async function tokenBridgeForChainContract(
    client: CliqueClient,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string
): Promise<Contract> {
    const variables = {
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperBinCode: "00",
        serdeAddress: "00",
        tokenBridgeForChainBinCode: "00",
        tokenBridgeForChainCodeHash: "00",
    }
    return Contract.from(client, 'token_bridge_for_chain.ral', variables)
}

async function tokenWrapperContract(client: CliqueClient): Promise<Contract> {
    const variables = {
        serdeAddress: "00",
        tokenBridgeForChainBinCode: "00",
        tokenBridgeForChainCodeHash: "00",
        tokenWrapperBinCode: "00",
        tokenWrapperCodeHash: "00",
        tokenWrapperFactoryAddress: "00",
    }
    return Contract.from(client, 'token_wrapper.ral', variables)
}
