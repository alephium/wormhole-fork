import { binToHex } from '@alephium/web3'
import { CHAIN_ID_UNSET } from 'alephium-wormhole-sdk'
import { execSync } from 'child_process'
import axios from 'axios'
import { assert, getBridgeChains, getSignedVAA, sleep } from '../utils'
import {
  getGuardianByIndex,
  getNextGovernanceSequence,
  governanceChainId,
  governanceEmitterId,
  guardianRpcPorts,
  runCmdInContainer
} from './governance_utils'

const newGuardianSet = ['0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe', '0x88D7D8B32a9105d228100E72dFFe2Fae0705D31c']
const newGuardianSetIndex = 1

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

async function injectGuardianSetUpgrade(): Promise<Uint8Array> {
  // we only need to inject the vaa on guardian-0
  const container = await getGuardianByIndex(0)
  const fileName = 'guardian-set-upgrade.proto'
  const seq = await getNextGovernanceSequence()
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

async function waitGuardianSetSynced(
  expectedGuardianSet: string[],
  expectedGuardianSetIndex: number,
  port: number,
  timeout: number
) {
  const url = `http://127.0.0.1:${port}/v1/guardianset/current`
  if (timeout <= 0) {
    throw new Error(`Fetch current gurdian set from ${url} timeout`)
  }
  const result = await axios.get(url, { responseType: 'json' })
  if (result.data.message) {
    throw new Error(`Failed to fetch current guardian set from ${url}`)
  }
  console.log(`Get guardian set from ${url}, result: ${JSON.stringify(result.data)}`)

  const keys = result.data.guardianSet.addresses as string[]
  const index = result.data.guardianSet.index as number
  if (index !== expectedGuardianSetIndex) {
    await sleep(3)
    await waitGuardianSetSynced(expectedGuardianSet, expectedGuardianSetIndex, port, timeout - 3)
    return
  }

  if (keys.length !== expectedGuardianSet.length) {
    throw new Error(`Invalid guardian set, expected ${expectedGuardianSet}, has ${keys}`)
  }

  for (let i = 0; i < keys.length; i++) {
    assert(keys[i].toLowerCase() === expectedGuardianSet[i].toLowerCase())
  }
}

async function guardianSetUpgrade() {
  await checkGuardianSet(newGuardianSet.slice(0, 1))
  const signedVaa = await injectGuardianSetUpgrade()
  await submitGuardianSetUpgrade(signedVaa)
  await checkGuardianSet(newGuardianSet)

  for (const port of guardianRpcPorts) {
    await waitGuardianSetSynced(newGuardianSet, newGuardianSetIndex, port, 45)
  }
}

guardianSetUpgrade()
