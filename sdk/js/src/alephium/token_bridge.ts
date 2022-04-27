import { Script } from 'alephium-web3'

const createLocalTokenWrapper = JSON.parse(`{
  "sourceCodeSha256": "bb77b2435369a463cb4f032104e9b4df16d609dcb3c92a8db224d80a8b0616f0",
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
  "sourceCodeSha256": "8f1be1a691851c5b730315e50719acbe96dee6bd9fea5f4d89fbd870e3f2761c",
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
  "sourceCodeSha256": "9db25452601528c907edefb356b8db27f3f1637270ea26738e7e58fd35e1ee63",
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
  "sourceCodeSha256": "89f74063b86a0ad4e83244d2a017326e76d90aed340807e179d8ee25cb86e8e8",
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
  "sourceCodeSha256": "829db38059abd54c8c689282d1dc250772fcd01b916fac75c532eaa320fe20a8",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "01010100010006{tokenWrapperId:ByteVec}1700{vaa:ByteVec}{arbiter:Address}1600010c"
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
  "sourceCodeSha256": "95b63ac6296f8471a9b9314b254fda0001397597d9216496b08224ce82c28583",
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
  "sourceCodeSha256": "1e161e9c2e6d7b5378f497e27e6921b83f6bd331053010e902069ce54099591b",
  "compiled": {
    "type": "TemplateScriptByteCode",
    "templateByteCode": "01010100010006{tokenBridgeId:ByteVec}1700{vaa:ByteVec}{arbiter:Address}16000112"
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
