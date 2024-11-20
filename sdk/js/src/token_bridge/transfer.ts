import { ALPH_TOKEN_ID, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import {
  Algodv2,
  bigIntToBytes,
  getApplicationAddress,
  makeApplicationCallTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  OnApplicationComplete,
  SuggestedParams,
  Transaction as AlgorandTransaction,
} from "algosdk";
import { BigNumber, ethers, Overrides, PayableOverrides } from "ethers";
import { TransferLocal, TransferRemote } from "../alephium-contracts/ts/scripts";
import {
  assetOptinCheck,
  getMessageFee,
  optin,
  TransactionSignerPair,
} from "../algorand";
import { getEmitterAddressAlgorand } from "../bridge";
import {
  Bridge__factory,
  TokenImplementation__factory,
} from "../ethers-contracts";
import {
  ChainId,
  ChainName,
  CHAIN_ID_ALEPHIUM,
  coalesceChainId,
  createNonce,
  hexToUint8Array,
  textToUint8Array
} from "../utils";
import { safeBigIntToNumber } from "../utils/bigint";

export async function transferLocalTokenFromAlph(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  fromAddress: string,
  localTokenId: string,
  toChainId: ChainId,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel: number,
  nonce?: string
): Promise<ExecuteScriptResult> {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  return TransferLocal.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      fromAddress: fromAddress,
      localTokenId: localTokenId,
      alphChainId: BigInt(CHAIN_ID_ALEPHIUM),
      toChainId: BigInt(toChainId),
      toAddress: toAddress,
      tokenAmount: tokenAmount,
      arbiterFee: arbiterFee,
      nonce: nonceHex,
      consistencyLevel: BigInt(consistencyLevel)
    },
    attoAlphAmount: localTokenId === ALPH_TOKEN_ID ? messageFee + tokenAmount : messageFee,
    tokens: localTokenId === ALPH_TOKEN_ID
      ? []
      : [{ id: localTokenId, amount: tokenAmount }, { id: ALPH_TOKEN_ID, amount: DUST_AMOUNT * BigInt(2) }]
  })
}

export async function transferRemoteTokenFromAlph(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  fromAddress: string,
  tokenPoolId: string,
  remoteTokenId: string,
  tokenChainId: ChainId,
  toChainId: ChainId,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel: number,
  nonce?: string
): Promise<ExecuteScriptResult> {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  return TransferRemote.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      fromAddress: fromAddress,
      tokenPoolId: tokenPoolId,
      remoteTokenId: remoteTokenId,
      tokenChainId: BigInt(tokenChainId),
      toChainId: BigInt(toChainId),
      toAddress: toAddress,
      tokenAmount: tokenAmount,
      arbiterFee: arbiterFee,
      nonce: nonceHex,
      consistencyLevel: BigInt(consistencyLevel)
    },
    attoAlphAmount: messageFee,
    tokens: [{ id: tokenPoolId, amount: tokenAmount }, { id: ALPH_TOKEN_ID, amount: DUST_AMOUNT * BigInt(2) }]
  })
}

export async function getAllowanceEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  const signerAddress = await signer.getAddress();
  const allowance = await token.allowance(signerAddress, tokenBridgeAddress);

  return allowance;
}

export async function approveEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  return await (
    await token.approve(tokenBridgeAddress, amount, overrides)
  ).wait();
}

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferTokens(
    tokenAddress,
    amount,
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    overrides
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainId,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.wrapAndTransferETH(
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    {
      ...overrides,
      value: amount,
    }
  );
  const receipt = await v.wait();
  return receipt;
}

/**
 * Transfers an asset from Algorand to a receiver on another chain
 * @param client AlgodV2 client
 * @param tokenBridgeId Application ID of the token bridge
 * @param bridgeId Application ID of the core bridge
 * @param sender Sending account
 * @param assetId Asset index
 * @param qty Quantity to transfer
 * @param receiver Receiving account
 * @param chain Reeiving chain
 * @param fee Transfer fee
 * @param payload payload for payload3 transfers
 * @returns Sequence number of confirmation
 */
export async function transferFromAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  assetId: bigint,
  qty: bigint,
  receiver: string,
  chain: ChainId | ChainName,
  fee: bigint,
  payload: Uint8Array | null = null
): Promise<TransactionSignerPair[]> {
  const recipientChainId = coalesceChainId(chain);
  const tokenAddr: string = getApplicationAddress(tokenBridgeId);
  const applAddr: string = getEmitterAddressAlgorand(tokenBridgeId);
  const txs: TransactionSignerPair[] = [];
  // "transferAsset"
  const { addr: emitterAddr, txs: emitterOptInTxs } = await optin(
    client,
    senderAddr,
    bridgeId,
    BigInt(0),
    applAddr
  );
  txs.push(...emitterOptInTxs);
  let creator;
  let creatorAcctInfo: any;
  let wormhole: boolean = false;
  if (assetId !== BigInt(0)) {
    const assetInfo: Record<string, any> = await client
      .getAssetByID(safeBigIntToNumber(assetId))
      .do();
    creator = assetInfo["params"]["creator"];
    creatorAcctInfo = await client.accountInformation(creator).do();
    const authAddr: string = creatorAcctInfo["auth-addr"];
    if (authAddr === tokenAddr) {
      wormhole = true;
    }
  }

  const params: SuggestedParams = await client.getTransactionParams().do();
  const msgFee: bigint = await getMessageFee(client, bridgeId);
  if (msgFee > 0) {
    const payTxn: AlgorandTransaction =
      makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        suggestedParams: params,
        to: getApplicationAddress(tokenBridgeId),
        amount: msgFee,
      });
    txs.push({ tx: payTxn, signer: null });
  }
  if (!wormhole) {
    const bNat = Buffer.from("native", "binary").toString("hex");
    // "creator"
    const result = await optin(
      client,
      senderAddr,
      tokenBridgeId,
      assetId,
      bNat
    );
    creator = result.addr;
    txs.push(...result.txs);
  }
  if (
    assetId !== BigInt(0) &&
    !(await assetOptinCheck(client, assetId, creator))
  ) {
    // Looks like we need to optin
    const payTxn: AlgorandTransaction =
      makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddr,
        to: creator,
        amount: 100000,
        suggestedParams: params,
      });
    txs.push({ tx: payTxn, signer: null });
    // The tokenid app needs to do the optin since it has signature authority
    const bOptin: Uint8Array = textToUint8Array("optin");
    let txn = makeApplicationCallTxnFromObject({
      from: senderAddr,
      appIndex: safeBigIntToNumber(tokenBridgeId),
      onComplete: OnApplicationComplete.NoOpOC,
      appArgs: [bOptin, bigIntToBytes(assetId, 8)],
      foreignAssets: [safeBigIntToNumber(assetId)],
      accounts: [creator],
      suggestedParams: params,
    });
    txn.fee *= 2;
    txs.push({ tx: txn, signer: null });
  }
  const t = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: [textToUint8Array("nop")],
    suggestedParams: params,
  });
  txs.push({ tx: t, signer: null });

  let accounts: string[] = [];
  if (assetId === BigInt(0)) {
    const t = makePaymentTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      amount: qty,
      suggestedParams: params,
    });
    txs.push({ tx: t, signer: null });
    accounts = [emitterAddr, creator, creator];
  } else {
    const t = makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: senderAddr,
      to: creator,
      suggestedParams: params,
      amount: qty,
      assetIndex: safeBigIntToNumber(assetId),
    });
    txs.push({ tx: t, signer: null });
    accounts = [emitterAddr, creator, creatorAcctInfo["address"]];
  }
  let args = [
    textToUint8Array("sendTransfer"),
    bigIntToBytes(assetId, 8),
    bigIntToBytes(qty, 8),
    hexToUint8Array(receiver),
    bigIntToBytes(recipientChainId, 8),
    bigIntToBytes(fee, 8),
  ];
  if (payload !== null) {
    args.push(payload);
  }
  let acTxn = makeApplicationCallTxnFromObject({
    from: senderAddr,
    appIndex: safeBigIntToNumber(tokenBridgeId),
    onComplete: OnApplicationComplete.NoOpOC,
    appArgs: args,
    foreignApps: [safeBigIntToNumber(bridgeId)],
    foreignAssets: [safeBigIntToNumber(assetId)],
    accounts: accounts,
    suggestedParams: params,
  });
  acTxn.fee *= 2;
  txs.push({ tx: acTxn, signer: null });
  return txs;
}
