import { ChainId } from '@alephium/wormhole-sdk'
import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { reset as resetTransfer } from './transferSlice'

type BridgeWidgetTransferSteps = 0 | 1 | 2
type BridgeWidgetPage = 'bridge' | 'recovery' | 'history' | 'register'

export interface TransferState {
  activeBridgeWidgetStep: BridgeWidgetTransferSteps
  hasSentTokens: boolean
  isTokenPickerDialogOpen: boolean
  finalityProgressInitialRemainingBlocks: number | undefined
  finalityProgressInitialRemainingSeconds: number | undefined
  bridgeWidgetPage: BridgeWidgetPage
  recoverySourceChain: ChainId | undefined
  recoverySourceTx: string | undefined
}

const initialState: TransferState = {
  activeBridgeWidgetStep: 0,
  hasSentTokens: false,
  isTokenPickerDialogOpen: false,
  finalityProgressInitialRemainingBlocks: undefined,
  finalityProgressInitialRemainingSeconds: undefined,
  bridgeWidgetPage: 'bridge',
  recoverySourceChain: undefined,
  recoverySourceTx: undefined
}

export const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    setBridgeWidgetStep: (state, action: PayloadAction<BridgeWidgetTransferSteps>) => {
      state.activeBridgeWidgetStep = action.payload
    },
    openTokenPickerDialog: (state) => {
      state.isTokenPickerDialogOpen = true
    },
    closeTokenPickerDialog: (state) => {
      state.isTokenPickerDialogOpen = false
    },
    setHasSentTokens: (state, action: PayloadAction<boolean>) => {
      state.hasSentTokens = action.payload
    },
    setFinalityProgressInitialRemainingBlocks: (state, action: PayloadAction<number | undefined>) => {
      state.finalityProgressInitialRemainingBlocks = action.payload
    },
    setFinalityProgressInitialRemainingSeconds: (state, action: PayloadAction<number | undefined>) => {
      state.finalityProgressInitialRemainingSeconds = action.payload
    },
    setBridgeWidgetPage: (state, action: PayloadAction<BridgeWidgetPage>) => {
      state.bridgeWidgetPage = action.payload
    },
    setRecoverySourceChainFromTxHistoryPage: (state, action: PayloadAction<ChainId | undefined>) => {
      state.recoverySourceChain = action.payload
    },
    setRecoverySourceTxFromTxHistoryPage: (state, action: PayloadAction<string | undefined>) => {
      state.recoverySourceTx = action.payload
    }
  },
  extraReducers: (builder) => {
    builder.addCase(resetTransfer, () => initialState)
  }
})

export const {
  setBridgeWidgetStep,
  openTokenPickerDialog,
  closeTokenPickerDialog,
  setHasSentTokens,
  setFinalityProgressInitialRemainingBlocks,
  setFinalityProgressInitialRemainingSeconds,
  setBridgeWidgetPage,
  setRecoverySourceChainFromTxHistoryPage,
  setRecoverySourceTxFromTxHistoryPage
} = widgetSlice.actions

export default widgetSlice.reducer
