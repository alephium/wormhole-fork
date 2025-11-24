import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH } from '@alephium/wormhole-sdk'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { StateSafeWormholeWrappedInfo } from '../hooks/useCheckIfWormholeWrapped'
import { ForeignAssetInfo } from '../hooks/useFetchForeignAsset'
import { AcalaRelayerInfo } from '../hooks/useAcalaRelayerInfo'
import { DataWrapper, errorDataWrapper, fetchDataWrapper, getEmptyDataWrapper, receiveDataWrapper } from './helpers'
import i18n from '../i18n'

const LAST_STEP = 3

type Steps = 0 | 1 | 2 | 3

export interface ParsedTokenAccount {
  publicKey: string
  mintKey: string
  amount: string
  decimals: number
  uiAmount: number
  uiAmountString: string
  symbol?: string
  name?: string
  logo?: string
  isNativeAsset?: boolean
}

export interface Transaction {
  id: string
  blockHeight: number
  blockTimestamp?: number
}

export interface TransferState {
  activeStep: Steps
  sourceChain: ChainId
  sourceAssetInfo: DataWrapper<StateSafeWormholeWrappedInfo>
  sourceWalletAddress: string | undefined
  sourceParsedTokenAccount: ParsedTokenAccount | undefined
  sourceParsedTokenAccounts: DataWrapper<ParsedTokenAccount[]>
  amount: string
  targetChain: ChainId
  targetAddressHex: string | undefined
  targetAsset: DataWrapper<ForeignAssetInfo>
  targetParsedTokenAccount: ParsedTokenAccount | undefined
  transferTx: Transaction | undefined
  recoverySourceTxId: string | undefined
  signedVAAHex: string | undefined
  isSending: boolean
  isWalletApproved: boolean
  isRedeeming: boolean
  isRedeemingViaRelayer: boolean
  isRedeemedViaRelayer: boolean
  redeemTx: Transaction | undefined
  isRedeemCompleted: boolean
  isApproving: boolean
  isRecovery: boolean
  gasPrice: number | undefined
  useRelayer: boolean
  relayerFee: string | undefined
  acalaRelayerInfo: DataWrapper<AcalaRelayerInfo>
  isBlockFinalized: boolean
}

const initialState: TransferState = {
  activeStep: 0,
  sourceChain: CHAIN_ID_ETH,
  sourceAssetInfo: getEmptyDataWrapper(),
  sourceWalletAddress: undefined,
  sourceParsedTokenAccount: undefined,
  sourceParsedTokenAccounts: getEmptyDataWrapper(),
  amount: '',
  targetChain: CHAIN_ID_ALEPHIUM,
  targetAddressHex: undefined,
  targetAsset: getEmptyDataWrapper(),
  targetParsedTokenAccount: undefined,
  transferTx: undefined,
  recoverySourceTxId: undefined,
  signedVAAHex: undefined,
  isSending: false,
  isWalletApproved: false,
  isRedeeming: false,
  isRedeemingViaRelayer: false,
  isRedeemedViaRelayer: false,
  redeemTx: undefined,
  isRedeemCompleted: false,
  isApproving: false,
  isRecovery: false,
  gasPrice: undefined,
  useRelayer: false,
  relayerFee: undefined,
  acalaRelayerInfo: getEmptyDataWrapper(),
  isBlockFinalized: false
}

export const transferSlice = createSlice({
  name: 'transfer',
  initialState,
  reducers: {
    incrementStep: (state) => {
      if (state.activeStep < LAST_STEP) state.activeStep++
    },
    decrementStep: (state) => {
      if (state.activeStep > 0) state.activeStep--
    },
    setStep: (state, action: PayloadAction<Steps>) => {
      state.activeStep = action.payload
    },
    setSourceChain: (state, action: PayloadAction<ChainId>) => {
      const prevSourceChain = state.sourceChain
      state.sourceChain = action.payload
      state.sourceParsedTokenAccount = undefined
      state.sourceParsedTokenAccounts = getEmptyDataWrapper()
      // clear targetAsset so that components that fire before useFetchTargetAsset don't get stale data
      state.targetAsset = getEmptyDataWrapper()
      state.targetParsedTokenAccount = undefined
      state.targetAddressHex = undefined
      state.sourceAssetInfo = getEmptyDataWrapper()
      if (state.targetChain === action.payload) {
        state.targetChain = prevSourceChain
      }
    },
    setSourceWormholeWrappedInfo: (state, action: PayloadAction<DataWrapper<StateSafeWormholeWrappedInfo>>) => {
      state.sourceAssetInfo = action.payload
    },
    setSourceWalletAddress: (state, action: PayloadAction<string | undefined>) => {
      state.sourceWalletAddress = action.payload
    },
    setSourceParsedTokenAccount: (state, action: PayloadAction<ParsedTokenAccount | undefined>) => {
      const buildAccountKey = (account: ParsedTokenAccount | undefined) => {
        if (!account) {
          return undefined
        }
        const maybeTokenId = (account as typeof account & { tokenId?: string }).tokenId ?? ''
        return `${account.mintKey}:${maybeTokenId}`
      }

      const previousAccount = state.sourceParsedTokenAccount
      const nextAccount = action.payload

      state.sourceParsedTokenAccount = nextAccount

      const previousKey = buildAccountKey(previousAccount)
      const nextKey = buildAccountKey(nextAccount)
      const didChange = previousKey !== nextKey

      if (didChange) {
        // clear targetAsset so that components that fire before useFetchTargetAsset don't get stale data
        state.targetAsset = getEmptyDataWrapper()
        state.targetParsedTokenAccount = undefined
        state.targetAddressHex = undefined
        state.sourceAssetInfo = getEmptyDataWrapper()
      }
    },
    setSourceParsedTokenAccounts: (state, action: PayloadAction<ParsedTokenAccount[] | undefined>) => {
      state.sourceParsedTokenAccounts = action.payload ? receiveDataWrapper(action.payload) : getEmptyDataWrapper()
    },
    fetchSourceParsedTokenAccounts: (state) => {
      state.sourceParsedTokenAccounts = fetchDataWrapper()
    },
    errorSourceParsedTokenAccounts: (state, action: PayloadAction<string | undefined>) => {
      state.sourceParsedTokenAccounts = errorDataWrapper(action.payload || i18n.t('An unknown error occurred.'))
    },
    receiveSourceParsedTokenAccounts: (state, action: PayloadAction<ParsedTokenAccount[]>) => {
      state.sourceParsedTokenAccounts = receiveDataWrapper(action.payload)
    },
    setAmount: (state, action: PayloadAction<string>) => {
      state.amount = action.payload
    },
    setTargetChain: (state, action: PayloadAction<ChainId>) => {
      const prevTargetChain = state.targetChain
      state.targetChain = action.payload
      state.targetAddressHex = undefined
      // clear targetAsset so that components that fire before useFetchTargetAsset don't get stale data
      state.targetAsset = getEmptyDataWrapper()
      state.targetParsedTokenAccount = undefined
      if (state.sourceChain === action.payload) {
        state.sourceChain = prevTargetChain
        state.activeStep = 0
        state.sourceParsedTokenAccount = undefined
        state.sourceAssetInfo = getEmptyDataWrapper()
        state.sourceParsedTokenAccounts = getEmptyDataWrapper()
      }
    },
    setTargetAddressHex: (state, action: PayloadAction<string | undefined>) => {
      state.targetAddressHex = action.payload
    },
    setTargetAsset: (state, action: PayloadAction<DataWrapper<ForeignAssetInfo>>) => {
      state.targetAsset = action.payload
      state.targetParsedTokenAccount = undefined
    },
    setTargetParsedTokenAccount: (state, action: PayloadAction<ParsedTokenAccount | undefined>) => {
      state.targetParsedTokenAccount = action.payload
    },
    setTransferTx: (state, action: PayloadAction<Transaction>) => {
      state.transferTx = action.payload
    },
    setRecoverySourceTxId: (state, action: PayloadAction<string>) => {
      state.recoverySourceTxId = action.payload
    },
    setSignedVAAHex: (state, action: PayloadAction<string>) => {
      state.signedVAAHex = action.payload
      state.isSending = false
      state.isWalletApproved = false
      state.activeStep = 3
    },
    setIsSending: (state, action: PayloadAction<boolean>) => {
      state.isSending = action.payload
    },
    setIsWalletApproved: (state, action: PayloadAction<boolean>) => {
      state.isWalletApproved = action.payload
    },
    setIsRedeeming: (state, action: PayloadAction<boolean>) => {
      state.isRedeeming = action.payload
    },
    setIsRedeemingViaRelayer: (state, action: PayloadAction<boolean>) => {
      state.isRedeemingViaRelayer = action.payload
    },
    setRedeemTx: (state, action: PayloadAction<Transaction>) => {
      state.redeemTx = action.payload
      state.isRedeeming = false
      state.isRedeemingViaRelayer = false
      state.isWalletApproved = false
      state.isBlockFinalized = false
    },
    setIsRedeemedViaRelayer: (state, action: PayloadAction<boolean>) => {
      state.isRedeemedViaRelayer = action.payload
    },
    setRedeemCompleted: (state) => {
      state.isRedeemCompleted = true
      state.isRedeeming = false
      state.isRedeemingViaRelayer = false
      state.isWalletApproved = false
      state.isBlockFinalized = false
    },
    setIsApproving: (state, action: PayloadAction<boolean>) => {
      state.isApproving = action.payload
    },
    reset: (state) => ({
      ...initialState,
      sourceChain: state.sourceChain,
      targetChain: state.targetChain
    }),
    setRecoveryVaa: (
      state,
      action: PayloadAction<{
        vaa: string
        useRelayer: boolean
        parsedPayload: {
          sourceTxId: string
          sourceChain: ChainId
          targetChain: ChainId
          targetAddress: string
          originChain: ChainId
          originAddress: string
          amount: string
        }
      }>
    ) => {
      state.signedVAAHex = action.payload.vaa
      state.targetChain = action.payload.parsedPayload.targetChain
      state.recoverySourceTxId = action.payload.parsedPayload.sourceTxId
      state.sourceChain = action.payload.parsedPayload.sourceChain
      state.sourceParsedTokenAccount = undefined
      state.sourceParsedTokenAccounts = getEmptyDataWrapper()
      // clear targetAsset so that components that fire before useFetchTargetAsset don't get stale data
      state.targetAsset = getEmptyDataWrapper()
      state.targetParsedTokenAccount = undefined
      state.targetAddressHex = action.payload.parsedPayload.targetAddress
      state.sourceAssetInfo = receiveDataWrapper({
        isWrapped: action.payload.parsedPayload.originChain !== action.payload.parsedPayload.sourceChain,
        chainId: action.payload.parsedPayload.originChain,
        assetAddress: action.payload.parsedPayload.originAddress
      })
      state.amount = action.payload.parsedPayload.amount
      state.activeStep = 3
      state.isRecovery = true
      state.redeemTx = undefined
      state.isRedeemCompleted = false
      state.useRelayer = action.payload.useRelayer
    },
    setGasPrice: (state, action: PayloadAction<number | undefined>) => {
      state.gasPrice = action.payload
    },
    setUseRelayer: (state, action: PayloadAction<boolean | undefined>) => {
      state.useRelayer = !!action.payload
    },
    setRelayerFee: (state, action: PayloadAction<string | undefined>) => {
      state.relayerFee = action.payload
    },
    setAcalaRelayerInfo: (state, action: PayloadAction<AcalaRelayerInfo | undefined>) => {
      state.acalaRelayerInfo = action.payload ? receiveDataWrapper(action.payload) : getEmptyDataWrapper()
    },
    fetchAcalaRelayerInfo: (state) => {
      state.acalaRelayerInfo = fetchDataWrapper()
    },
    errorAcalaRelayerInfo: (state, action: PayloadAction<string | undefined>) => {
      state.acalaRelayerInfo = errorDataWrapper(action.payload || i18n.t('An unknown error occurred.'))
    },
    receiveAcalaRelayerInfo: (state, action: PayloadAction<AcalaRelayerInfo>) => {
      state.acalaRelayerInfo = receiveDataWrapper(action.payload)
    },
    setIsBlockFinalized: (state, action: PayloadAction<boolean>) => {
      state.isBlockFinalized = action.payload
    }
  }
})

export const {
  incrementStep,
  decrementStep,
  setStep,
  setSourceChain,
  setSourceWormholeWrappedInfo,
  setSourceWalletAddress,
  setSourceParsedTokenAccount,
  setSourceParsedTokenAccounts,
  receiveSourceParsedTokenAccounts,
  errorSourceParsedTokenAccounts,
  fetchSourceParsedTokenAccounts,
  setAmount,
  setTargetChain,
  setTargetAddressHex,
  setTargetAsset,
  setTargetParsedTokenAccount,
  setTransferTx,
  setRecoverySourceTxId,
  setSignedVAAHex,
  setIsSending,
  setIsWalletApproved,
  setIsRedeeming,
  setIsRedeemingViaRelayer,
  setRedeemTx,
  setIsRedeemedViaRelayer,
  setRedeemCompleted,
  setIsApproving,
  reset,
  setRecoveryVaa,
  setGasPrice,
  setUseRelayer,
  setRelayerFee,
  setAcalaRelayerInfo,
  fetchAcalaRelayerInfo,
  errorAcalaRelayerInfo,
  receiveAcalaRelayerInfo,
  setIsBlockFinalized
} = transferSlice.actions

export default transferSlice.reducer
