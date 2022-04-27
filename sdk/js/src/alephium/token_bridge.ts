import { Script } from 'alephium-web3'

const createLocalTokenWrapper = JSON.parse(`{
  "sourceCodeSha256": "78f5b5a98efd3d173b6bf727716b118674a948205dde04b11095ff2111f8453e",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "0101010001000a{payer:Address}{alphAmount:U256}a2{tokenBridgeForChainId:ByteVec}1700{tokenId:ByteVec}{payer:Address}{alphAmount:U256}1600010c"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function createLocalTokenWrapperScript(): Script {
    return Script.fromJson(createLocalTokenWrapper)
}

const createRemoteTokenWrapper = JSON.parse(`{
  "sourceCodeSha256": "f4b9a71c9160be7696ddefb2bb01a4a3e06f13f9a9019382dae38f208e734eb5",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "0101010001000a{payer:Address}{alphAmount:U256}a2{tokenBridgeForChainId:ByteVec}1700{vaa:ByteVec}{payer:Address}{alphAmount:U256}1600010d"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function createRemoteTokenWrapperScript(): Script {
    return Script.fromJson(createRemoteTokenWrapper)
}

const transferLocalToken = JSON.parse(`{
  "sourceCodeSha256": "f63cba7e367f15061658d39665b3ad48075ec9f1350d18a4987651fcec4b651c",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "01010100010011{sender:Address}{messageFee:U256}a2{sender:Address}{localTokenId:ByteVec}{tokenAmount:U256}a3{tokenWrapperId:ByteVec}1700{sender:Address}{toAddress:ByteVec}{tokenAmount:U256}{arbiterFee:U256}{nonce:ByteVec}{consistencyLevel:U256}1600010a"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function transferLocalTokenScript(): Script {
    return Script.fromJson(transferLocalToken)
}

const transferRemoteToken = JSON.parse(`{
  "sourceCodeSha256": "134db6b934b26f373b12543247bc54690a1e9daf2180020c251d913fbd9aa916",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "01010100010011{sender:Address}{messageFee:U256}a2{sender:Address}{tokenWrapperId:ByteVec}{tokenAmount:U256}a3{tokenWrapperId:ByteVec}1700{sender:Address}{toAddress:ByteVec}{tokenAmount:U256}{arbiterFee:U256}{nonce:ByteVec}{consistencyLevel:U256}1600010a"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function transferRemoteTokenScript(): Script {
    return Script.fromJson(transferRemoteToken)
}

const completeTransfer = JSON.parse(`{
  "sourceCodeSha256": "e27e6b4a37ba29633ed911bf97338366972d2e40d7e7ce6df442d001af323505",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "0101010001000a0c5913c1e8d4a51000a2{tokenWrapperId:ByteVec}1700{vaa:ByteVec}{arbiter:Address}1600010c"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function completeTransferScript(): Script {
    return Script.fromJson(completeTransfer)
}

const attestToken = JSON.parse(`{
  "sourceCodeSha256": "baffdf05d9f0409132cebd40ea2acf3c3265f6c27e06eddd4158abe3cebd5569",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "0101010001000b{payer:Address}{messageFee:U256}a2{tokenBridgeId:ByteVec}1700{payer:Address}{tokenId:ByteVec}{nonce:ByteVec}{consistencyLevel:U256}1600010f"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function attestTokenScript(): Script {
    return Script.fromJson(attestToken)
}

const completeUndoneSequence = JSON.parse(`{
  "sourceCodeSha256": "386f239be22309c2826d1e51e8919730ceb384e636f0b1b25e14d7f87d964ae1",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "0101010001000a0c5913c1e8d4a51000a2{tokenBridgeId:ByteVec}1700{vaa:ByteVec}{arbiter:Address}16000112"
  },
  "functions": [
    {
      "name": "main",
      "signature": "pub payable main()->()",
      "argTypes": [],
      "returnTypes": []
    }
  ]
}`)
export function completeUndoneSequenceScript(): Script {
    return Script.fromJson(completeUndoneSequence)
}
