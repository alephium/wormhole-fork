import { randomBytes, randomInt } from "crypto"
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH } from "./consts"
import {
  serializeVAA,
  extractBodyFromVAA,
  extractSequenceFromVAA,
  deserializeVAA,
  Signature,
  TransferToken,
  VAABody,
  VAAPayload,
  deserializeTransferTokenPayload,
  serializeTransferTokenPayload,
  serializeContractUpgradePayload,
  deserializeContractUpgradePayload,
  Module,
  serializeGuardianSetUpgradePayload,
  deserializeGuardianSetUpgradePayload,
  serializeUpdateMessageFeePayload,
  deserializeUpdateMessageFeePayload,
  serializeTransferFeePayload,
  deserializeTransferFeePayload,
  serializeAlphContractUpgradePayload,
  deserializeAlphContractUpgradePayload,
  serializeRegisterChainPayload,
  deserializeRegisterChainPayload,
  serializeDestroyUnexecutedSequencesPayload,
  deserializeDestroyUnexecutedSequencesPayload,
  serializeUpdateMinimalConsistencyLevelPayload,
  deserializeUpdateMinimalConsistencyLevelPayload,
  serializeUpdateRefundAddressPayload,
  deserializeUpdateRefundAddressPayload,
  serializeAttestTokenPayload,
  deserializeAttestTokenPayload,
  extractPayloadFromVAA,
  RegisterChain,
  signVAABody
} from "./vaa"

describe('serialize/deserialize vaa', () => {
  function randomNumber(bytes: number): number {
    return Math.floor(Math.random() * (Math.pow(2, 8 * bytes) - 1))
  }

  function randomSignatures(): Signature[] {
    const sigSize = randomInt(1, 9)
    return Array.from(Array(sigSize).keys()).map(idx => {
      return new Signature(idx, randomBytes(65))
    })
  }

  function testSerdeVAA<T extends VAAPayload>(payload: T, targetChainId?: ChainId) {
    const vaa = {
      version: randomNumber(1),
      guardianSetIndex: randomNumber(4),
      signatures: randomSignatures(),
      body: {
        timestamp: randomNumber(4),
        nonce: randomNumber(4),
        emitterChainId: randomInt(0, 10) as ChainId,
        targetChainId: targetChainId ?? randomInt(0, 10) as ChainId,
        emitterAddress: randomBytes(32),
        sequence: BigInt(randomNumber(8)),
        consistencyLevel: randomNumber(1),
        payload: payload,
      }
    }
    const encoded = serializeVAA(vaa)
    expect(deserializeVAA(encoded)).toEqual(vaa)
  }

  it('should test serialize/deserialize vaa', () => {
    const transferTokenVAA = Buffer.from('01000000010200d41571b3e10141df5c3fd3c332a42327ec0c6e78fe5cec4a3d807abccfce9674558daa0a8d8f78b19a01557e0dd8be842370aaae8c3e520a0269c7f3d5e9e2ce0101f9f91cc48a6955ad5711df0efd3897dd2b7f9f92a5721833dc21ec27a8795b8901e3bb1933e96e5e1bd687e6ceceec6de34081e9a855ab40eed43b30bf4a089a000000000000000000000200ff0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c1600000000000002010f010000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000', 'hex')
    const signatures = [
      Signature.from(Buffer.from('00d41571b3e10141df5c3fd3c332a42327ec0c6e78fe5cec4a3d807abccfce9674558daa0a8d8f78b19a01557e0dd8be842370aaae8c3e520a0269c7f3d5e9e2ce01', 'hex')),
      Signature.from(Buffer.from('01f9f91cc48a6955ad5711df0efd3897dd2b7f9f92a5721833dc21ec27a8795b8901e3bb1933e96e5e1bd687e6ceceec6de34081e9a855ab40eed43b30bf4a089a00', 'hex'))
    ]
    const body: VAABody<TransferToken> = {
      timestamp: 0,
      nonce: 0,
      emitterChainId: CHAIN_ID_ETH,
      targetChainId: CHAIN_ID_ALEPHIUM,
      emitterAddress: Buffer.from('0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16', 'hex'),
      sequence: BigInt(513),
      consistencyLevel: 15,
      payload: {
        type: 'TransferToken',
        amount: BigInt('1000000000000000000'),
        originAddress: Buffer.from('000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e', 'hex'),
        originChain: CHAIN_ID_ETH,
        targetAddress: Buffer.from('bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a', 'hex'),
        fee: BigInt(0)
      }
    }
    const vaa = deserializeVAA(transferTokenVAA)
    expect(vaa.version).toEqual(1)
    expect(vaa.guardianSetIndex).toEqual(1)
    expect(vaa.signatures).toEqual(signatures)
    expect(vaa.body).toEqual(body)
    expect(serializeVAA(vaa)).toEqual(transferTokenVAA)
  })

  it('should test serialize/deserialize ContractUpgrade payload', () => {
    const data = Buffer.from('00000000000000000000000000000000000000000000000000000000436f726501ed183dcdb0c6ee0bcd1123cbe4d51788eb35ec80e53fc5d73842053f75152a4f', 'hex')
    const payload = deserializeContractUpgradePayload(data)
    expect(payload).toEqual({
      type: 'ContractUpgrade',
      module: 'Core',
      newContractAddress: Buffer.from('ed183dcdb0c6ee0bcd1123cbe4d51788eb35ec80e53fc5d73842053f75152a4f', 'hex')
    })
    expect(serializeContractUpgradePayload(payload)).toEqual(data)

    function testSerdeContractUpgrade(module: Module) {
      testSerdeVAA({
        type: 'ContractUpgrade',
        module: module,
        newContractAddress: randomBytes(32)
      })
    }

    testSerdeContractUpgrade('Core')
    testSerdeContractUpgrade('TokenBridge')
    testSerdeContractUpgrade('NFTBridge')
  })

  it('should test serialize/deserialize GuardianSetUpgrade payload', () => {
    const data = Buffer.from('00000000000000000000000000000000000000000000000000000000436f726502000000010384ded443fdda382ce54cd733caee24c365deb3bcf07b3681a387b36dfbb532a0f7f83185d36c353ac6add15a85ebd4c21f5d2fe85745502e2e236f63', 'hex')
    const payload = deserializeGuardianSetUpgradePayload(data)
    expect(payload).toEqual({
      type: 'GuardianSetUpgrade',
      module: 'Core',
      newGuardianSetIndex: 1,
      newGuardianSet: [
        Buffer.from('84ded443fdda382ce54cd733caee24c365deb3bc', 'hex'),
        Buffer.from('f07b3681a387b36dfbb532a0f7f83185d36c353a', 'hex'),
        Buffer.from('c6add15a85ebd4c21f5d2fe85745502e2e236f63', 'hex')
      ]
    })
    expect(serializeGuardianSetUpgradePayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'GuardianSetUpgrade',
      module: 'Core',
      newGuardianSetIndex: randomNumber(4),
      newGuardianSet: Array.from(Array(randomNumber(1)).keys()).map(() => randomBytes(20))
    })
  })

  it('should test serialize/deserialize UpdateMessageFee payload', () => {
    const data = Buffer.from('00000000000000000000000000000000000000000000000000000000436f7265030000000000000000000000000000000000000000000000000000000000002710', 'hex')
    const payload = deserializeUpdateMessageFeePayload(data)
    expect(payload).toEqual({
      type: 'UpdateMessageFee',
      module: 'Core',
      newMessageFee: BigInt(10000)
    })
    expect(serializeUpdateMessageFeePayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'UpdateMessageFee',
      module: 'Core',
      newMessageFee: BigInt(randomNumber(8))
    })
  })

  it('should test serialize/deserialize TransferFee payload', () => {
    const data = Buffer.from('00000000000000000000000000000000000000000000000000000000436f72650400000000000000000000000000000000000000000000000000000000000007d0103b9bb25e1cb02cb918ff9e591c3543a0b2dc65dc4ddef25baab6cc885b3786', 'hex')
    const payload = deserializeTransferFeePayload(data)
    expect(payload).toEqual({
      type: 'TransferFee',
      module: 'Core',
      amount: BigInt(2000),
      recipient: Buffer.from('103b9bb25e1cb02cb918ff9e591c3543a0b2dc65dc4ddef25baab6cc885b3786', 'hex')
    })
    expect(serializeTransferFeePayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'TransferFee',
      module: 'Core',
      amount: BigInt(randomNumber(8)),
      recipient: randomBytes(32)
    })
  })

  it('should test serialize/deserialize AlphContractUpgrade payload', () => {
    const data = Buffer.from('000000000000000000000000000000000000000000546f6b656e427269646765020041c2e69ac2ff5628a214c505b869349ea2f5239160f3b1f664ecbc75e41367a37ae8ebe52b6b222e294a20d452579fe88dd2054d6b088ed4f6c37a18ed2bbfd94b64c5e1a1150838a8245505dfe0106827709e5d7b84f9c4dd6c023389653eb7b817009bbc2b5ba4da6a43ce413be6437050f51c3b51eb4aa2b968326526f1f84682c11a26e9edc63541518ce88f4d573e54b063d13d24964d26d7866e415cfdc3bfa372900d1c30cfbf98865f23baa415242da2209cdb97d1bc9f8de6cf7e4e2d577c51242dd6660a9d5d099b721d97ad84270b76914db94076156ccff0f35eeb9101b2eb4cdb86cdf9344da02c096fa5c50cd202be4116b1948594110f6b', 'hex')
    const payload = deserializeAlphContractUpgradePayload(data)
    expect(payload).toEqual({
      type: 'AlphContractUpgrade',
      module: 'TokenBridge',
      newCode: Buffer.from('c2e69ac2ff5628a214c505b869349ea2f5239160f3b1f664ecbc75e41367a37ae8ebe52b6b222e294a20d452579fe88dd2054d6b088ed4f6c37a18ed2bbfd94b64', 'hex'),
      prevStateHash: Buffer.from('c5e1a1150838a8245505dfe0106827709e5d7b84f9c4dd6c023389653eb7b817', 'hex'),
      newState: Buffer.from('bc2b5ba4da6a43ce413be6437050f51c3b51eb4aa2b968326526f1f84682c11a26e9edc63541518ce88f4d573e54b063d13d24964d26d7866e415cfdc3bfa372900d1c30cfbf98865f23baa415242da2209cdb97d1bc9f8de6cf7e4e2d577c51242dd6660a9d5d099b721d97ad84270b76914db94076156ccff0f35eeb9101b2eb4cdb86cdf9344da02c096fa5c50cd202be4116b1948594110f6b', 'hex')
    })
    expect(serializeAlphContractUpgradePayload(payload)).toEqual(data)

    function testSerdeAlphContractUpgrade(module: 'TokenBridge' | 'Core', changeState: boolean) {
      testSerdeVAA({
        type: 'AlphContractUpgrade',
        module: module,
        newCode: randomBytes(randomNumber(1)),
        prevStateHash: changeState ? randomBytes(32) : undefined,
        newState: changeState ? randomBytes(randomNumber(1)) : undefined
      }, CHAIN_ID_ALEPHIUM)
    }

    testSerdeAlphContractUpgrade('Core', true)
    testSerdeAlphContractUpgrade('Core', false)
    testSerdeAlphContractUpgrade('TokenBridge', true)
    testSerdeAlphContractUpgrade('TokenBridge', false)
  })

  it('should test serialize/deserialize RegisterChain payload', () => {
    const data = Buffer.from('000000000000000000000000000000000000000000546f6b656e427269646765010002f82707844dcd33499fd97193b18c2025e338c162762b740020f13e431852f0e7', 'hex')
    const payload = deserializeRegisterChainPayload(data)
    expect(payload).toEqual({
      type: 'RegisterChain',
      module: 'TokenBridge',
      emitterChainId: CHAIN_ID_ETH,
      emitterAddress: Buffer.from('f82707844dcd33499fd97193b18c2025e338c162762b740020f13e431852f0e7', 'hex')
    })
    expect(serializeRegisterChainPayload(payload)).toEqual(data)

    function testSerdeRegisterChain(module: 'TokenBridge' | 'NFTBridge') {
      testSerdeVAA({
        type: 'RegisterChain',
        module: module,
        emitterChainId: randomInt(0, 10) as ChainId,
        emitterAddress: randomBytes(32)
      })
    }

    testSerdeRegisterChain('TokenBridge')
    testSerdeRegisterChain('NFTBridge')
  })

  it('should test serialize/deserialize DestroyUnexecutedSequences payload', () => {
    const data = Buffer.from('000000000000000000000000000000000000000000546f6b656e427269646765f0000200040000000000000000000000000000000200000000000000030000000000000007', 'hex')
    const payload = deserializeDestroyUnexecutedSequencesPayload(data)
    expect(payload).toEqual({
      type: 'DestroyUnexecutedSequences',
      module: 'TokenBridge',
      emitterChainId: CHAIN_ID_ETH,
      indexes: [BigInt(0), BigInt(2), BigInt(3), BigInt(7)]
    })
    expect(serializeDestroyUnexecutedSequencesPayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'DestroyUnexecutedSequences',
      module: 'TokenBridge',
      emitterChainId: randomInt(0, 10) as ChainId,
      indexes: Array.from(Array(randomInt(1, 8)).keys()).map(idx => BigInt(idx))
    })
  })

  it('should test serialize/deserialize UpdateMinimalConsistencyLevel payload', () => {
    const data = Buffer.from('000000000000000000000000000000000000000000546f6b656e427269646765f10a', 'hex')
    const payload = deserializeUpdateMinimalConsistencyLevelPayload(data)
    expect(payload).toEqual({
      type: 'UpdateMinimalConsistencyLevel',
      module: 'TokenBridge',
      newConsistencyLevel: 10
    })
    expect(serializeUpdateMinimalConsistencyLevelPayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'UpdateMinimalConsistencyLevel',
      module: 'TokenBridge',
      newConsistencyLevel: randomNumber(1)
    })
  })

  it('should test serialize/deserialize UpdateRefundAddress payload', () => {
    const data = Buffer.from('000000000000000000000000000000000000000000546f6b656e427269646765f200d3c7b75e955eab1d85d02795f7f5c3f26f03f949d6679c17f71c84ecb59f049fe931bb3b573f0dbc2d90a91c4d7884475844a2b8f244d5e0d79f9580a2949b170ecc0e9562a4c5ca34229a9118317d3a6fbf5980869037f4047cd148253429cf85eef1e7122a25d1a1f22a5389b8bdc0b9e7f695cbf36755264c7d3e3f034f73c31af47d4fc87301be312b9598a65b625df5f7ea3c4c88f3f41a55636459c1bfc34264999d77987efe5240b8b459f047da33132fce7ce53e7aa32f82513700cb34111e9d8e12590c107768acd0b35ad4c1e2800a', 'hex')
    const payload = deserializeUpdateRefundAddressPayload(data)
    expect(payload).toEqual({
      type: 'UpdateRefundAddress',
      module: 'TokenBridge',
      newRefundAddress: Buffer.from('c7b75e955eab1d85d02795f7f5c3f26f03f949d6679c17f71c84ecb59f049fe931bb3b573f0dbc2d90a91c4d7884475844a2b8f244d5e0d79f9580a2949b170ecc0e9562a4c5ca34229a9118317d3a6fbf5980869037f4047cd148253429cf85eef1e7122a25d1a1f22a5389b8bdc0b9e7f695cbf36755264c7d3e3f034f73c31af47d4fc87301be312b9598a65b625df5f7ea3c4c88f3f41a55636459c1bfc34264999d77987efe5240b8b459f047da33132fce7ce53e7aa32f82513700cb34111e9d8e12590c107768acd0b35ad4c1e2800a', 'hex')
    })
    expect(serializeUpdateRefundAddressPayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'UpdateRefundAddress',
      module: 'TokenBridge',
      newRefundAddress: randomBytes(randomNumber(1))
    })
  })

  it('should test serialize/deserialize AttestToken payload', () => {
    const data = Buffer.from('02eb2b70a55aec8562b6ccc6ca3ca4ed41176c611757a37748d005abee6a9fae5a00ff0a000000000000000000000000000000000000000000000054657374546f6b656e00000000000000000000000000000000000000000054657374546f6b656e2d30', 'hex')
    const payload = deserializeAttestTokenPayload(data)
    expect(payload).toEqual({
      type: 'AttestToken',
      tokenId: Buffer.from('eb2b70a55aec8562b6ccc6ca3ca4ed41176c611757a37748d005abee6a9fae5a', 'hex'),
      tokenChainId: CHAIN_ID_ALEPHIUM,
      decimals: 10,
      symbol: 'TestToken',
      name: 'TestToken-0'
    })
    expect(serializeAttestTokenPayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'AttestToken',
      tokenId: randomBytes(32),
      tokenChainId: randomInt(0, 10) as ChainId,
      decimals: randomNumber(1),
      symbol: randomBytes(5).toString('hex'),
      name: randomBytes(6).toString('hex')
    })
  })

  it('should test serialize/deserialize TransferToken payload', () => {
    const data = Buffer.from('010000000000000000000000000000000000000000000000000000000000002710a612b5c90e6b5c377a964b177bb74d7d8d02ea266d0a1e0236de314d0b1406c500ff81fd92a0ce6c9657e47025e9daba0edb6a023637f39fd3c71f341e2f1765c2420000000000000000000000000000000000000000000000000000000000000000', 'hex')
    const payload = deserializeTransferTokenPayload(data)
    expect(payload).toEqual({
      type: 'TransferToken',
      amount: BigInt(10000),
      originAddress: Buffer.from('a612b5c90e6b5c377a964b177bb74d7d8d02ea266d0a1e0236de314d0b1406c5', 'hex'),
      originChain: CHAIN_ID_ALEPHIUM,
      targetAddress: Buffer.from('81fd92a0ce6c9657e47025e9daba0edb6a023637f39fd3c71f341e2f1765c242', 'hex'),
      fee: BigInt(0)
    })
    expect(serializeTransferTokenPayload(payload)).toEqual(data)

    testSerdeVAA({
      type: 'TransferToken',
      amount: BigInt(randomNumber(8)),
      originAddress: randomBytes(32),
      originChain: randomInt(0, 10) as ChainId,
      targetAddress: randomBytes(32),
      fee: BigInt(randomNumber(8))
    })
  })

  it('should test extract body/payload/sequence', () => {
    const vaa = Buffer.from('01000000010200d41571b3e10141df5c3fd3c332a42327ec0c6e78fe5cec4a3d807abccfce9674558daa0a8d8f78b19a01557e0dd8be842370aaae8c3e520a0269c7f3d5e9e2ce0101f9f91cc48a6955ad5711df0efd3897dd2b7f9f92a5721833dc21ec27a8795b8901e3bb1933e96e5e1bd687e6ceceec6de34081e9a855ab40eed43b30bf4a089a000000000000000000000200ff0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c1600000000000002010f010000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000', 'hex')
    const body = extractBodyFromVAA(vaa)
    expect(body).toEqual(Buffer.from('0000000000000000000200ff0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c1600000000000002010f010000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000', 'hex'))

    const payload = extractPayloadFromVAA(vaa)
    expect(payload).toEqual(Buffer.from('010000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000', 'hex'))

    const sequence = extractSequenceFromVAA(vaa)
    expect(sequence).toEqual(BigInt(513))
  })

  it('should sign vaa body', () => {
    const body: VAABody<RegisterChain<'TokenBridge'>> = {
      timestamp: 1,
      nonce: 1,
      emitterChainId: 1,
      targetChainId: 0,
      emitterAddress: Buffer.from('0000000000000000000000000000000000000000000000000000000000000004', 'hex'),
      sequence: BigInt(0),
      consistencyLevel: 0,
      payload: {
        type: 'RegisterChain',
        module: 'TokenBridge',
        emitterChainId: 2,
        emitterAddress: Buffer.from('0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16', 'hex')
      }
    }
    const signatures = signVAABody(
      ['cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0', 'c3b2e45c422a1602333a64078aeb42637370b0f48fe385f9cfa6ad54a8e0c47e'],
      body
    )
    expect(signatures.length).toEqual(2)
    expect(signatures[0].index).toEqual(0)
    expect(signatures[0].sig).toEqual(Buffer.from('667549ac50a1f11588f7cd432bb591b515852b641474ee043e0b05015b14598d29add6805312e0d2235f45790b0efdb401dd38bbea098478c90fc512584de3b101', 'hex'))
    expect(signatures[1].index).toEqual(1)
    expect(signatures[1].sig).toEqual(Buffer.from('db49c715ce76d6905a701fa99fbdd2f67aad473176f4e98dffff7e6a855a7b534da26e226e54ccf6b91993a09d2854d11033bc3299d8f3321688492c6da09d3300', 'hex'))
  })
})
