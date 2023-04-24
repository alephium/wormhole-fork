import {
  BridgeImplementation__factory,
  GovernancePayload,
  Implementation__factory,
  NFTBridgeImplementation__factory
} from "alephium-wormhole-sdk"
import { ethers } from "ethers"
import { CONFIGS } from "./configs"
import { impossible } from "./utils"
import { EVMChainName } from "alephium-wormhole-sdk"
import axios from "axios";
import * as celo from "@celo-tools/celo-ethers-wrapper";

export async function executeGovernanceEvm(
  payload: GovernancePayload,
  vaa: Buffer,
  network: "MAINNET" | "TESTNET" | "DEVNET",
  chain: EVMChainName,
  nodeUrl?: string
) {
  const n = CONFIGS[network][chain]
  const rpc = nodeUrl ?? n.rpc
  if (rpc === undefined) {
    throw Error(`No ${network} rpc defined for ${chain} (see networks.ts)`)
  }
  if (!n.key) {
    throw Error(`No ${network} key defined for ${chain} (see networks.ts)`)
  }
  const key: string = n.key

  let provider = undefined
  let signer = undefined
  if (chain === "celo") {
    provider = new celo.CeloProvider(rpc)
    await provider.ready
    signer = new celo.CeloWallet(key, provider)
  } else {
    provider = new ethers.providers.JsonRpcProvider(rpc)
    signer = new ethers.Wallet(key, provider)
  } 

  // Here we apply a set of chain-specific overrides.
  // NOTE: some of these might have only been tested on mainnet. If it fails in
  // testnet (or devnet), they might require additional guards
  let overrides: ethers.Overrides = {}
  if (chain === "karura" || chain == "acala") {
    overrides = await getKaruraGasParams(n.rpc)
  } else if (chain === "polygon") {
    let feeData = await provider.getFeeData();
    overrides = {
      maxFeePerGas: feeData.maxFeePerGas?.mul(50) || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(50) || undefined,
    };
  } else if (chain === "klaytn" || chain === "fantom") {
    overrides = { gasPrice: (await signer.getGasPrice()).toString() }
  }

  switch (payload.module) {
    case "Core":
      const governanceAddress = (n as any).governanceAddress
      if (governanceAddress === undefined) {
        throw Error(`Unknown core contract on ${network} for ${chain}`)
      }
      let c = new Implementation__factory(signer)
      let cb = c.attach(governanceAddress)
      switch (payload.type) {
        case "GuardianSetUpgrade":
          console.log("Submitting new guardian set")
          console.log("Hash: " + (await cb.submitNewGuardianSet(vaa, overrides)).hash)
          break
        case 'UpdateMessageFee':
          console.log('Submitting update message fee')
          console.log(`Hash: ${(await cb.submitSetMessageFee(vaa, overrides)).hash}`)
          break
        case 'TransferFee':
          console.log('Submitting transfer fee')
          console.log(`Hash: ${(await cb.submitTransferFees(vaa, overrides)).hash}`)
          break
        case "ContractUpgrade":
          console.log("Upgrading core contract")
          console.log("Hash: " + (await cb.submitContractUpgrade(vaa, overrides)).hash)
          break
        default:
          throw new Error(`Invalid governance payload type: ${payload.type}`)
      }
      break
    case "NFTBridge":
      const nftBridgeAddress = (n as any).nftBridgeAddress
      if (nftBridgeAddress === undefined) {
        throw Error(`Unknown nft bridge contract on ${network} for ${chain}`)
      }
      let nftBridge = new NFTBridgeImplementation__factory(signer)
      let nb = nftBridge.attach(nftBridgeAddress)
      switch (payload.type) {
        case "ContractUpgrade":
          console.log("Upgrading contract")
          console.log("Hash: " + (await nb.upgrade(vaa, overrides)).hash)
          console.log("Don't forget to verify the new implementation! See ethereum/VERIFY.md for instructions")
          break
        case "RegisterChain":
          console.log("Registering chain")
          console.log("Hash: " + (await nb.registerChain(vaa, overrides)).hash)
          break
        default:
          impossible(payload)

      }
      break
    case "TokenBridge":
      const tokenBridgeAddress = (n as any).tokenBridgeAddress
      if (tokenBridgeAddress === undefined) {
        throw Error(`Unknown token bridge contract on ${network} for ${chain}`)
      }
      let t = new BridgeImplementation__factory(signer)
      let tb = t.attach(tokenBridgeAddress)
      switch (payload.type) {
        case "ContractUpgrade":
          console.log("Upgrading contract")
          console.log("Hash: " + (await tb.upgrade(vaa, overrides)).hash)
          console.log("Don't forget to verify the new implementation! See ethereum/VERIFY.md for instructions")
          break
        case "RegisterChain":
          console.log("Registering chain")
          console.log("Hash: " + (await tb.registerChain(vaa, overrides)).hash)
          break
        default:
          throw new Error(`Invalid governance payload type: ${payload.type}`)
      }
      break
    default:
      impossible(payload)
  }
}

export async function getKaruraGasParams(rpc: string): Promise<{
  gasPrice: number;
  gasLimit: number;
}> {
  const gasLimit = 21000000;
  const storageLimit = 64001;
  const res = (
    await axios.post(rpc, {
      id: 0,
      jsonrpc: "2.0",
      method: "eth_getEthGas",
      params: [
        {
          gasLimit,
          storageLimit,
        },
      ],
    })
  ).data.result;

  return {
    gasLimit: parseInt(res.gasLimit, 16),
    gasPrice: parseInt(res.gasPrice, 16),
  };
}
