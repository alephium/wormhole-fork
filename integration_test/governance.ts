import { binToHex } from '@alephium/web3'
import { ChainId, CHAIN_ID_UNSET, coalesceChainName } from 'alephium-wormhole-sdk'
import Dockerode, { Container } from 'dockerode'
import { assert, BridgeChain, getSignedVAA, Sequence } from './utils'
import { execSync } from 'child_process'
import { createAlephium } from './alph'
import { createEth } from './eth'
import axios from 'axios'

const docker = new Dockerode()
const sequence = new Sequence(0)
const governanceChainId = 1
const governanceEmitterId = '0000000000000000000000000000000000000000000000000000000000000004'
const newGuardianSet = ['0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe', '0x88D7D8B32a9105d228100E72dFFe2Fae0705D31c']
const guardianRpcPorts = [7071, 8071]

type BridgeChains = {
  eth: BridgeChain
  alph: BridgeChain
}

let bridgeChains: BridgeChains | undefined = undefined

async function getBridgeChains(): Promise<BridgeChains> {
  if (bridgeChains !== undefined) {
    return bridgeChains
  }
  const alph = await createAlephium()
  const eth = await createEth()
  bridgeChains = { eth, alph }
  return bridgeChains
}

function createGuardianSetUpgradeVaa(sequence: number): string {
  return `
    current_set_index: 0
    messages: {
      sequence: ${sequence}
      nonce: 0
      guardian_set: {
        guardians: {
          pubkey: "${newGuardianSet[0]}"
          name: "Guardian 0"
        }
        guardians: {
          pubkey: "${newGuardianSet[1]}"
          name: "Guardian 1"
        }
      }
    }
  `
}

async function getGuardianByIndex(index: number) {
  const containers = await docker.listContainers()
  const guardian = containers.find((c) => c.Names.some((name) => name.includes(`guardian-${index}`)))
  if (guardian === undefined) {
    throw new Error(`Guardian ${index} does not exist`)
  }
  return guardian
}

async function runCmdInContainer(container: Container, cmd: string[], workDir: string) {
  console.log(`Executing ${cmd.join(' ')} on container ${container.id}, working dir: ${workDir}`)
  const exec = await container.exec({
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    Cmd: cmd,
    WorkingDir: workDir
  })
  const execOpts = { Detach: false, Tty: false, stream: true, stdin: true, stdout: true, stderr: true }
  const stream = await exec.start(execOpts)
  stream.setEncoding('utf8')
  stream.pipe(process.stdout)
}

async function injectGuardianSetUpgrade(): Promise<Uint8Array> {
  // we only need to inject the vaa on guardian-0
  const guardian0 = await getGuardianByIndex(0)
  const container = docker.getContainer(guardian0.Id)
  const fileName = 'guardian-set-upgrade.proto'
  const seq = sequence.next()
  const guardianSetUpgradeVaa = createGuardianSetUpgradeVaa(seq)
  await runCmdInContainer(container, ['bash', '-c', `echo '${guardianSetUpgradeVaa}' > ${fileName}`], '/')
  await runCmdInContainer(
    container,
    ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
    '/'
  )
  return await getSignedVAA(governanceChainId, governanceEmitterId, CHAIN_ID_UNSET, seq)
}

async function submitGuardianSetUpgrade(signedVaa: Uint8Array) {
  const signedVaaHex = binToHex(signedVaa)
  console.log(`Guardian set upgrade signed vaa: ${signedVaaHex}`)

  for (const chain of ['alephium', 'ethereum']) {
    const command = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -c ${chain} -n devnet`
    console.log(`Submitting guardian set upgrade vaa to ${chain}`)
    execSync(command)
  }
}

async function checkGuardianSet(expected: string[]) {
  const chains = await getBridgeChains()
  const alphGuardianSet = await chains.alph.getCurrentGuardianSet()
  console.log(`Current guardian set on Alephium: ${alphGuardianSet}`)
  assert(alphGuardianSet.length === expected.length)

  const ethGuardianSet = await chains.eth.getCurrentGuardianSet()
  console.log(`Current guardian set on Ethereum: ${ethGuardianSet}`)
  assert(ethGuardianSet.length === expected.length)

  for (let i = 0; i < expected.length; i++) {
    const expectedKey = expected[i].slice(2).toLowerCase()
    assert(alphGuardianSet[i].toLowerCase() === expectedKey)
    assert(ethGuardianSet[i].slice(2).toLowerCase() === expectedKey)
  }
}

async function guardianSetUpgrade() {
  await checkGuardianSet(newGuardianSet.slice(0, 1))
  const signedVaa = await injectGuardianSetUpgrade()
  await submitGuardianSetUpgrade(signedVaa)
  await checkGuardianSet(newGuardianSet)
}

function createUpdateMessageFeeVaa(sequence: number, messageFee: bigint, chainId: ChainId): string {
  const messageFeeHex = messageFee.toString(16).padStart(64, '0')
  return `
    current_set_index:  1
    messages:  {
      sequence: ${sequence}
      nonce: 0
      target_chain_id: ${chainId}
      update_message_fee:  {
        new_message_fee:  "${messageFeeHex}"
      }
    }
  `
}

async function updateMessageFeeOnChain(chain: BridgeChain) {
  const currentMessageFee = await chain.getCurrentMessageFee()
  console.log(`Current message fee on Alephium is ${currentMessageFee}`)
  const newMessageFee = currentMessageFee + 1000n
  const seq = sequence.next()
  for (const guardianIndex of [0, 1]) {
    const guardian0 = await getGuardianByIndex(guardianIndex)
    const container = docker.getContainer(guardian0.Id)
    const fileName = `update-message-fee-${chain.chainId}.proto`
    const updateMessageFeeVaa = createUpdateMessageFeeVaa(seq, newMessageFee, chain.chainId)
    await runCmdInContainer(container, ['bash', '-c', `echo '${updateMessageFeeVaa}' > ${fileName}`], '/')
    await runCmdInContainer(
      container,
      ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
      '/'
    )
  }
  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, chain.chainId, seq)
  const signedVaaHex = binToHex(signedVaa)
  const chainName = coalesceChainName(chain.chainId)
  console.log(`Update message signed vaa for ${chainName}: ${signedVaaHex}`)
  const submitCommand = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -n devnet`
  console.log(`Submitting update message fee vaa to ${chainName}`)
  execSync(submitCommand)

  const expectedMessageFee = await chain.getCurrentMessageFee()
  assert(expectedMessageFee === newMessageFee)
}

async function updateMessageFee() {
  const chains = await getBridgeChains()
  updateMessageFeeOnChain(chains.alph)

  updateMessageFeeOnChain(chains.eth)
}

async function sleep(seconds: number) {
  await new Promise((r) => setTimeout(r, seconds * 1000))
}

async function waitGuardianSetSynced(expectedGuardianSet: string[], expectedGuardianSetIndex: number, port: number) {
  const url = `http://127.0.0.1:${port}/v1/guardianset/current`
  const result = await axios.get(url, { responseType: 'json' })
  if (result.data.message) {
    throw new Error(`Failed to fetch current guardian set from ${url}`)
  }
  console.log(`Get guardian set from ${url}, result: ${JSON.stringify(result.data)}`)

  const keys = result.data.guardianSet.addresses as string[]
  const index = result.data.guardianSet.index as number
  if (index !== expectedGuardianSetIndex) {
    await sleep(3)
    await waitGuardianSetSynced(expectedGuardianSet, expectedGuardianSetIndex, port)
    return
  }

  if (keys.length !== expectedGuardianSet.length) {
    throw new Error(`Invalid guardian set, expected ${expectedGuardianSet}, has ${keys}`)
  }

  for (let i = 0; i < keys.length; i++) {
    assert(keys[i].toLowerCase() === expectedGuardianSet[i].toLowerCase())
  }
}

async function testGovernanceActions() {
  await guardianSetUpgrade()

  for (const port of guardianRpcPorts) {
    await waitGuardianSetSynced(newGuardianSet, 1, port)
  }

  await updateMessageFee()
}

testGovernanceActions()
