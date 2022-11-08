import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, CHAIN_ID_UNSET } from 'alephium-wormhole-sdk'
import { randomBytes } from 'ethers/lib/utils'
import {
  PayloadIds as AlphPayloadIds,
  DestroyUnexecutedSequences,
  UpdateMinimalConsistencyLevel,
  UpdateRefundAddress
} from './alph'
import {
  Payload,
  VAA,
  sign,
  GuardianSetUpgrade,
  serialiseVAA,
  parse,
  CoreContractUpgrade,
  PortalContractUpgrade,
  AlphContractUpgrade,
  UpdateMessageFee,
  TransferFee,
  GovernanceExtension
} from './vaa'

describe('vaa serde tests', () => {
  const signers = [
    'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
    'c3b2e45c422a1602333a64078aeb42637370b0f48fe385f9cfa6ad54a8e0c47e'
  ]
  const guardianKeys = [
    'beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe'.toLowerCase(),
    '88D7D8B32a9105d228100E72dFFe2Fae0705D31c'.toLowerCase()
  ]
  const GOVERNANCE_CHAIN = CHAIN_ID_UNSET
  const GOVERNANCE_EMITTER = '0000000000000000000000000000000000000000000000000000000000000004'

  function randomNumber(bytes: number): number {
    const result = parseInt(Buffer.from(randomBytes(bytes)).toString('hex'), 16)
    return result
  }

  function createVAA(targetChainId: ChainId, payload: Payload): VAA<Payload> {
    const v: VAA<Payload> = {
      version: 1,
      guardianSetIndex: 0,
      signatures: [],
      timestamp: Math.floor(Date.now() / 1000),
      nonce: randomNumber(4),
      emitterChain: GOVERNANCE_CHAIN,
      targetChain: targetChainId,
      emitterAddress: GOVERNANCE_EMITTER,
      sequence: BigInt(randomNumber(8)),
      consistencyLevel: randomNumber(1),
      payload: payload,
    };
    v.signatures = sign(signers, v);
    return v;
  }

  function testSerde<P extends Payload>(vaa: VAA<P>, func?: (p: P) => void) {
    const encoded = Buffer.from(serialiseVAA(vaa), 'hex')
    const decoded = parse(encoded)
    if (func !== undefined) {
      func(decoded.payload as P)
    }
    expect(decoded).toEqual(vaa)
  }

  it('serde GuardianSetUpgrade', () => {
    const payload: GuardianSetUpgrade = {
      module: 'Core',
      type: 'GuardianSetUpgrade',
      newGuardianSetIndex: 1,
      newGuardianSetLength: 1,
      newGuardianSet: guardianKeys.slice(1)
    }
    for (const chainId of [CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH]) {
      testSerde(createVAA(chainId, payload))
    }
  })

  it('serde CoreContractUpgrade', () => {
    const payload: CoreContractUpgrade = {
      module: 'Core',
      type: 'ContractUpgrade',
      address: randomBytes(32)
    }
    testSerde(createVAA(CHAIN_ID_ETH, payload))
  })

  it('serde PortalContractUpgrade', () => {
    for (const module of ['TokenBridge', 'NFTBridge']) {
      const payload: PortalContractUpgrade<any> = {
        module: module,
        type: 'ContractUpgrade',
        address: randomBytes(32)
      }
      testSerde(createVAA(CHAIN_ID_ETH, payload))
    }
  })

  it('serde AlphContractUpgrade', () => {
    for (const module of ['Core', 'TokenBridge']) {
      const payload: AlphContractUpgrade<any> = {
        module: module,
        type: 'ContractUpgrade',
        code: randomBytes(randomNumber(1)),
        state: randomBytes(randomNumber(1))
      }
      testSerde(createVAA(CHAIN_ID_ALEPHIUM, payload), p => delete p['codeLength'])
    }
  })

  it('serde UpdateMessageFee', () => {
    const payload: UpdateMessageFee = {
      module: 'Core',
      type: 'UpdateMessageFee',
      newMessageFee: BigInt(randomNumber(4))
    }
    for (const chainId of [CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH]) {
      testSerde(createVAA(chainId, payload))
    }
  })

  it('serde TransferFee', () => {
    const payload: TransferFee = {
      module: 'Core',
      type: 'TransferFee',
      amount: BigInt(randomNumber(4)),
      recipient: randomBytes(32)
    }
    for (const chainId of [CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH]) {
      testSerde(createVAA(chainId, payload))
    }
  })

  it('serde Alephium DestroyUnexecutedSequences', () => {
    const action: DestroyUnexecutedSequences = {
      payloadId: AlphPayloadIds.DestroyUnexecutedSequencesId,
      sequences: [0, 1, 5, 8, 9]
    }
    const payload: GovernanceExtension<typeof CHAIN_ID_ALEPHIUM, 'TokenBridge', DestroyUnexecutedSequences> = {
      chainId: CHAIN_ID_ALEPHIUM,
      module: 'TokenBridge',
      type: 'Extension',
      action: action
    }
    testSerde(createVAA(CHAIN_ID_ALEPHIUM, payload), p => delete (p as any).action['length'])
  })

  it('serde Alephium UpdateMinimalConsistencyLevel', () => {
    const action: UpdateMinimalConsistencyLevel = {
      payloadId: AlphPayloadIds.UpdateMinimalConsistencyLevelId,
      newConsistencyLevel: randomNumber(1)
    }
    const payload: GovernanceExtension<typeof CHAIN_ID_ALEPHIUM, 'TokenBridge', UpdateMinimalConsistencyLevel> = {
      chainId: CHAIN_ID_ALEPHIUM,
      module: 'TokenBridge',
      type: 'Extension',
      action: action
    }
    testSerde(createVAA(CHAIN_ID_ALEPHIUM, payload))
  })

  it('serde Alephium UpdateRefundAddress', () => {
    const action: UpdateRefundAddress = {
      payloadId: AlphPayloadIds.UpdateRefundAddressId,
      newRefundAddress: randomBytes(randomNumber(1))
    }
    const payload: GovernanceExtension<typeof CHAIN_ID_ALEPHIUM, 'TokenBridge', UpdateRefundAddress> = {
      chainId: CHAIN_ID_ALEPHIUM,
      module: 'TokenBridge',
      type: 'Extension',
      action: action
    }
    testSerde(createVAA(CHAIN_ID_ALEPHIUM, payload), p => delete (p as any).action['length'])
  })
})
