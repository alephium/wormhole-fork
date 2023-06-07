import { CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, CHAIN_ID_UNSET } from 'alephium-wormhole-sdk'
import axios from 'axios'
import { assert, getBridgeChains, sleep } from '../utils'
import { getNextGovernanceSequence, guardianRpcPorts, injectVAA, newGuardianSet, newGuardianSetIndex, submitGovernanceVAA } from './governance_utils'

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
        guardians: {
          pubkey: "${newGuardianSet[2]}"
          name: "Guardian 2"
        }
      }
    }
  `
}

async function runGuardianSetUpgrade(): Promise<void> {
  // we only need to inject the vaa on guardian-0
  const seq = getNextGovernanceSequence()
  const guardianSetUpgradeVaa = createGuardianSetUpgradeVaa(seq)
  await injectVAA(guardianSetUpgradeVaa, 0, 'guardian-set-upgrade.proto')
  await submitGovernanceVAA('GuardianSetUpgrade', seq, CHAIN_ID_UNSET, [CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH])
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
  await runGuardianSetUpgrade()
  await checkGuardianSet(newGuardianSet)

  for (const port of guardianRpcPorts) {
    await waitGuardianSetSynced(newGuardianSet, newGuardianSetIndex, port, 45)
  }
}

guardianSetUpgrade()
