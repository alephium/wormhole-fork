import {
  CHAINS,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  ChainId,
  GovernancePayload,
  ethers_contracts
} from "@alephium/wormhole-sdk"
import { ethers } from "ethers"
import { CONFIGS } from "./configs"
import { impossible } from "./utils"
import { EVMChainName } from "@alephium/wormhole-sdk"
import axios from "axios";
import * as celo from "@celo-tools/celo-ethers-wrapper";
import { solidityKeccak256 } from "ethers/lib/utils"
import { default as guardianMainnetConfig } from '../../configs/guardian/mainnet.json'
import { default as ethereumMainnetConfig } from '../../configs/ethereum/mainnet.json'
import { default as bscMainnetConfig } from '../../configs/bsc/mainnet.json'

const _IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

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
      let c = new ethers_contracts.Implementation__factory(signer)
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
      let nftBridge = new ethers_contracts.NFTBridgeImplementation__factory(signer)
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
      let t = new ethers_contracts.BridgeImplementation__factory(signer)
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

export async function getImplementation(
  network: "MAINNET" | "TESTNET" | "DEVNET",
  chain: EVMChainName,
  module: "Core" | "NFTBridge" | "TokenBridge",
  contractAddress: string | undefined,
  _rpc: string | undefined
): Promise<ethers.BigNumber> {
  let n = CONFIGS[network][chain]
  let rpc: string | undefined = _rpc ?? n.rpc;
  if (rpc === undefined) {
    throw Error(`No ${network} rpc defined for ${chain} (see networks.ts)`)
  }

  switch (module) {
    case "Core":
      contractAddress = contractAddress ? contractAddress : (n as any).governanceAddress;
      break
    case "TokenBridge":
      contractAddress = contractAddress ? contractAddress : (n as any).tokenBridgeAddress;
      break
    case "NFTBridge":
      throw new Error('NFTBridge not supported')
    default:
      impossible(module)
  }

  return (await getStorageAt(rpc, contractAddress, _IMPLEMENTATION_SLOT, ["address"]))[0]
}

export async function queryContractEvm(
  network: "MAINNET" | "TESTNET" | "DEVNET",
  chain: EVMChainName,
  module: "Core" | "NFTBridge" | "TokenBridge",
  contractAddress: string | undefined,
  _rpc: string | undefined
): Promise<object> {
  let n = CONFIGS[network][chain]
  let rpc: string | undefined = _rpc ?? n.rpc;
  if (rpc === undefined) {
    throw Error(`No ${network} rpc defined for ${chain} (see networks.ts)`)
  }

  const provider = new ethers.providers.JsonRpcProvider(rpc)

  let result: any = {}

  switch (module) {
    case "Core":
      contractAddress = contractAddress ? contractAddress : (n as any).governanceAddress;
      if (contractAddress === undefined) {
        throw Error(`Unknown core contract on ${network} for ${chain}`)
      }
      const core = ethers_contracts.Implementation__factory.connect(contractAddress, provider)
      result.address = contractAddress
      result.currentGuardianSetIndex = await core.getCurrentGuardianSetIndex()
      result.guardianSet = {}
      for (let i of Array(result.currentGuardianSetIndex + 1).keys()) {
        let guardianSet = await core.getGuardianSet(i)
        result.guardianSet[i] = { keys: guardianSet[0], expiry: guardianSet[1] }
      }
      result.guardianSetExpiry = await core.getGuardianSetExpiry()
      result.chainId = await core.chainId()
      result.governanceChainId = await core.governanceChainId()
      result.governanceContract = await core.governanceContract()
      result.messageFee = await core.messageFee()
      result.implementation = (await getStorageAt(rpc, contractAddress, _IMPLEMENTATION_SLOT, ["address"]))[0]
      result.isInitialized = await core.isInitialized(result.implementation)
      break
    case "TokenBridge":
      contractAddress = contractAddress ? contractAddress : (n as any).tokenBridgeAddress;
      if (contractAddress === undefined) {
        throw Error(`Unknown token bridge contract on ${network} for ${chain}`)
      }
      const tb = ethers_contracts.BridgeImplementation__factory.connect(contractAddress, provider)
      result.address = contractAddress
      result.wormhole = await tb.wormhole()
      result.implementation = (await getStorageAt(rpc, contractAddress, _IMPLEMENTATION_SLOT, ["address"]))[0]
      result.isInitialized = await tb.isInitialized(result.implementation)
      result.tokenImplementation = await tb.tokenImplementation()
      result.chainId = await tb.chainId()
      result.governanceChainId = await tb.governanceChainId()
      result.governanceContract = await tb.governanceContract()
      result.WETH = await tb.WETH()
      result.registrations = {}
      for (let [chainName, chainId] of Object.entries(CHAINS)) {
        if (chainName === chain || chainName === "unset") {
          continue
        }
        result.registrations[chainName] = await tb.bridgeContracts(chainId)
      }
      break
    case "NFTBridge":
      throw new Error('NFTBridge not supported')
    default:
      impossible(module)
  }

  return result
}

/**
 *
 * Hijack a core contract. This function is useful when working with a mainnet
 * fork (hardhat or anvil). A fork of the mainnet contract will naturally store
 * the mainnet guardian set, so we can't readily interact with these contracts,
 * because we can't forge signed VAAs for those guardians. This function uses
 * [[setStorageAt]] to override the guardian set to something we have the
 * private keys for (typically the devnet guardian used for testing).
 * This way we can test contract upgrades before rolling them out on mainnet.
 *
 * @param rpc the JSON RPC endpoint (needs to be hardhat of anvil)
 * @param contractAddress address of the core bridge contract
 * @param guardianAddresses addresses of the desired guardian set to upgrade to
 * @param newGuardianSetIndex if specified, the new guardian set will be
 * written into this guardian set index, and the guardian set index of the
 * contract changed to it.
 * If unspecified, then the current guardian set index will be overridden.
 * In particular, it's possible to both upgrade or downgrade the guardian set
 * this way. The latter is useful for testing locally if you already have some
 * VAAs handy that are signed by guardian set 0.
 */
 export async function hijackEvm(
  rpc: string,
  contractAddress: string,
  guardianAddresses: string[],
  newGuardianSetIndex: number | undefined
): Promise<void> {
  const GUARDIAN_SETS_SLOT = 0x02
  const GUARDIAN_SET_INDEX_SLOT = 0x3

  const provider = new ethers.providers.JsonRpcProvider(rpc)
  const core = ethers_contracts.Implementation__factory.connect(contractAddress, provider)
  let guardianSetIndex: number
  let guardianSetExpiry: number
  [guardianSetIndex, guardianSetExpiry] = await getStorageAt(rpc, contractAddress, GUARDIAN_SET_INDEX_SLOT, ["uint32", "uint32"])
  console.log("Attempting to hijack core bridge guardian set.")
  const currentGuardianSet = await core.getGuardianSet(guardianSetIndex)
  console.log(`Current guardian set (index ${guardianSetIndex}):`)
  console.log(currentGuardianSet[0])

  if (newGuardianSetIndex !== undefined) {
    await setStorageAt(rpc, contractAddress, GUARDIAN_SET_INDEX_SLOT, ["uint32", "uint32"], [newGuardianSetIndex, guardianSetExpiry])
    guardianSetIndex = await core.getCurrentGuardianSetIndex()
    if (newGuardianSetIndex !== guardianSetIndex) {
      throw Error("Failed to update guardian set index.")
    } else {
      console.log(`Guardian set index updated to ${newGuardianSetIndex}`)
    }
  }
  const addressesSlot = computeMappingElemSlot(GUARDIAN_SETS_SLOT, guardianSetIndex)
  console.log(`Writing new set of guardians into set ${guardianSetIndex}...`)
  guardianAddresses.forEach(async (address, i) => {
    await setStorageAt(rpc, contractAddress, computeArrayElemSlot(addressesSlot, i), ["address"], [address])
  })
  await setStorageAt(rpc, contractAddress, addressesSlot, ["uint256"], [guardianAddresses.length])
  const afterGuardianSetIndex = await core.getCurrentGuardianSetIndex()
  const newGuardianSet = await core.getGuardianSet(afterGuardianSetIndex)
  console.log(`Current guardian set (index ${afterGuardianSetIndex}):`)
  console.log(newGuardianSet[0])
  console.log("Success.")
}

////////////////////////////////////////////////////////////////////////////////
// Storage manipulation
//
// Below we define a set of utilities for working with the EVM storage. For
// reference on storage layout, see [1].
//
// [1]: https://docs.soliditylang.org/en/v0.8.14/internals/layout_in_storage.html

export type StorageSlot = ethers.BigNumber
// we're a little more permissive in contravariant positions...
export type StorageSlotish = ethers.BigNumberish

/**
 *
 * Compute the storage slot of an array element.
 *
 * @param arraySlot the storage slot of the array variable
 * @param offset the index of the element to compute the storage slot for
 */
export function computeArrayElemSlot(arraySlot: StorageSlotish, offset: number): StorageSlot {
  return ethers.BigNumber.from(solidityKeccak256(["bytes"], [arraySlot])).add(offset)
}

/**
 *
 * Compute the storage slot of a mapping key.
 *
 * @param mapSlot the storage slot of the mapping variable
 * @param key the key to compute the storage slot for
 */
export function computeMappingElemSlot(mapSlot: StorageSlotish, key: any): StorageSlot {
  const slotPreimage = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256"], [key, mapSlot])
  return ethers.BigNumber.from(solidityKeccak256(["bytes"], [slotPreimage]))
}

export type Encoding
    = "uint8"
    | "uint16"
    | "uint32"
    | "uint64"
    | "uint128"
    | "uint256"
    | "bytes32"
    | "address"

export function typeWidth(type: Encoding): number {
  switch (type) {
      case "uint8": return 1
      case "uint16": return 2
      case "uint32": return 4
      case "uint64": return 8
      case "uint128": return 16
      case "uint256": return 32
      case "bytes32": return 32
      case "address": return 20
  }
}

// Couldn't find a satisfactory binary serialisation solution, so we just use
// the ethers library's encoding logic
export function encode(type: Encoding, val: any): string {
  // ethers operates on hex strings (sigh) and left pads everything to 32
  // bytes (64 characters). We take last 2*n characters where n is the width
  // of the type being serialised in bytes (since a byte is represented as 2
  // digits in hex).
  return ethers.utils.defaultAbiCoder.encode([type], [val]).substr(-2 * typeWidth(type))
}

/**
 *
 * Get the values stored in a storage slot. [[ethers.Provider.getStorageAt]]
 * returns the whole slot as one 32 byte value, but if there are multiple values
 * stored in the slot (which solidity does to save gas), it is useful to parse
 * the output accordingly. This function is a wrapper around the storage query
 * provided by [[ethers]] that does the additional parsing.
 *
 * @param rpc the JSON RPC endpoint
 * @param contractAddress address of the contract to be queried
 * @param storageSlot the storage slot to query
 * @param types The types of values stored in the storage slot. It's a list,
 * because solidity packs multiple values into a single storage slot to save gas
 * when the elements fit.
 *
 * @returns _values the values to write into the slot (packed)
 */
async function getStorageAt(rpc: string, contractAddress: string, storageSlot: StorageSlotish, types: Encoding[]): Promise<any[]> {
  const total = types.map((typ) => typeWidth(typ)).reduce((x, y) => (x + y))
  if (total > 32) {
    throw new Error(`Storage slots can contain a maximum of 32 bytes. Total size of ${types} is ${total} bytes.`)
  }

  const stringVal: string =
    await (new ethers.providers.JsonRpcProvider(rpc).getStorageAt(contractAddress, storageSlot))
  let val = ethers.BigNumber.from(stringVal)
  let ret: any[] = []
  // we decode the elements one by one, by shifting down the stuff we've parsed already
  types.forEach((typ) => {
    const padded = ethers.utils.defaultAbiCoder.encode(["uint256"], [val])
    ret.push(ethers.utils.defaultAbiCoder.decode([typ], padded)[0])
    val = val.shr(typeWidth(typ) * 8)
  })
  return ret
}

/**
 *
 * Use the 'hardhat_setStorageAt' rpc method to override a storage slot of a
 * contract. This method is understood by both hardhat and anvil (from foundry).
 * Useful for manipulating the storage of a forked mainnet contract (such as for
 * changing the guardian set to allow submitting VAAs to).
 *
 * @param rpc the JSON RPC endpoint (needs to be hardhat of anvil)
 * @param contractAddress address of the contract to be queried
 * @param storageSlot the storage slot to query
 * @param types The types of values stored in the storage slot. It's a list,
 * because solidity packs multiple values into a single storage slot to save gas
 * when the elements fit. This means that when writing into the slot, all values
 * must be accounted for, otherwise we end up zeroing out some fields.
 * @param values the values to write into the slot (packed)
 *
 * @returns the `data` property of the JSON response
 */
export async function setStorageAt(rpc: string, contractAddress: string, storageSlot: StorageSlotish, types: Encoding[], values: any[]): Promise<any> {
  // we need to reverse the values and types arrays, because the first element
  // is stored at the rightmost bytes.
  //
  // for example:
  //   uint32 a
  //   uint32 b
  // will be stored as 0x...b...a
  const _values = values.reverse()
  const _types = types.reverse()
  const total = _types.map((typ) => typeWidth(typ)).reduce((x, y) => (x + y))
  // ensure that the types fit into a slot
  if (total > 32) {
    throw new Error(`Storage slots can contain a maximum of 32 bytes. Total size of ${_types} is ${total} bytes.`)
  }
  if (_types.length !== _values.length) {
    throw new Error(`Expected ${_types.length} value(s), but got ${_values.length}.`)
  }
  // as far as I could tell, `ethers` doesn't provide a way to pack multiple
  // values into a single slot (the abi coder pads everything to 32 bytes), so we do it ourselves
  const val = "0x" + _types.map((typ, i) => encode(typ, _values[i])).reduce((x, y) => x + y).padStart(64, "0")
  // format the storage slot
  const slot = ethers.utils.defaultAbiCoder.encode(["uint256"], [storageSlot])
  console.log(`slot ${slot} := ${val}`)

  return (await axios.post(rpc, {
    id: 0,
    jsonrpc: "2.0",
    method: "hardhat_setStorageAt",
    params: [
      contractAddress,
      slot,
      val,
    ],
  })).data
}

export async function checkMainnetContract(
  chainId: ChainId,
  nodeUrl: string | undefined
) {
  if (chainId !== CHAIN_ID_ETH && chainId !== CHAIN_ID_BSC) {
    throw Error(`Invalid evm chain id ${chainId}`)
  }
  const config = chainId === CHAIN_ID_ETH ? ethereumMainnetConfig : bscMainnetConfig
  const provider = new ethers.providers.JsonRpcProvider(nodeUrl ?? config.nodeUrl)
  await checkGovernance(chainId, config.contracts.governance, provider)
  await checkTokenBridge(chainId, config.contracts.tokenBridge, config.contracts.wrappedNative, provider)
  console.log(`The deployed contract is correct`)
}

async function checkGovernance(
  expectedChainId: ChainId,
  governanceAddress: string,
  provider: ethers.providers.JsonRpcProvider
) {
  const governance = ethers_contracts.Implementation__factory.connect(governanceAddress, provider)
  const index = await governance.getCurrentGuardianSetIndex()
  const guardianSet = await governance.getGuardianSet(index)
  const signers = guardianSet[0]
  signers.forEach((address, index) => {
    const expected = guardianMainnetConfig.initSigners[index]
    if (expected.toLowerCase() !== address.toLowerCase()) {
      throw Error(`Invaid guardian signer at index ${index}, expected ${expected}, got ${address}`)
    }
  })

  checkChainParams(
    (await governance.chainId()) as ChainId,
    await governance.governanceChainId(),
    await governance.governanceContract(),
    expectedChainId
  )
}

async function checkTokenBridge(
  expectedChainId: ChainId,
  tokenBridgeAddress: string,
  expectedWrappedNative: string,
  provider: ethers.providers.JsonRpcProvider
) {
  const tokenBridge = ethers_contracts.BridgeImplementation__factory.connect(tokenBridgeAddress, provider)
  checkChainParams(
    (await tokenBridge.chainId()) as ChainId,
    await tokenBridge.governanceChainId(),
    await tokenBridge.governanceContract(),
    expectedChainId
  )
  const wrappedNative = await tokenBridge.WETH()
  if (wrappedNative !== expectedWrappedNative) {
    throw Error(`Invaid wrapped native address, expected ${expectedWrappedNative}, got ${wrappedNative}`)
  }
}

function checkChainParams(
  chainId: ChainId,
  governanceChainId: number,
  governanceContract: string,
  expectedChainId: ChainId
) {
  if (chainId !== expectedChainId) {
    throw Error(`Invaid chain id, expected ${expectedChainId}, got ${chainId}`)
  }
  if (governanceChainId !== guardianMainnetConfig.governanceChainId) {
    throw Error(`Invalid governance chain id, expected ${guardianMainnetConfig.governanceChainId}, got ${governanceChainId}`)
  }
  if (governanceContract !== '0x' + guardianMainnetConfig.governanceEmitterAddress) {
    throw Error(`Invalid governance contract, expected ${guardianMainnetConfig.governanceEmitterAddress}, got ${governanceContract}`)
  }
}
