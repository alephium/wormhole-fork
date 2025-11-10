import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type BridgeWidgetTransferSteps = 0 | 1 | 2
type BridgeWidgetPage = 'bridge' | 'recovery' | 'history' | 'register'

export interface TransferState {
  activeBridgeWidgetStep: BridgeWidgetTransferSteps
  hasSentTokens: boolean
  isTokenPickerDialogOpen: boolean
  finalityProgressInitialRemainingBlocks: number | undefined
  finalityProgressInitialRemainingSeconds: number | undefined
  bridgeWidgetPage: BridgeWidgetPage
}

const initialState: TransferState = {
  activeBridgeWidgetStep: 0,
  hasSentTokens: false,
  isTokenPickerDialogOpen: false,
  finalityProgressInitialRemainingBlocks: undefined,
  finalityProgressInitialRemainingSeconds: undefined,
  bridgeWidgetPage: 'bridge'
}

export const widgetSlice = createSlice({
  name: 'widget',
  initialState,
  reducers: {
    setBridgeWidgetStep: (state, action: PayloadAction<BridgeWidgetTransferSteps>) => {
      state.activeBridgeWidgetStep = action.payload
    },
    openTokenPickerDialog: (state) => {
      state.isTokenPickerDialogOpen = true;
    },
    closeTokenPickerDialog: (state) => {
      state.isTokenPickerDialogOpen = false;
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
    }
  }
})

export const {
  setBridgeWidgetStep,
  openTokenPickerDialog,
  closeTokenPickerDialog,
  setHasSentTokens,
  setFinalityProgressInitialRemainingBlocks,
  setFinalityProgressInitialRemainingSeconds,
  setBridgeWidgetPage
} = widgetSlice.actions

export default widgetSlice.reducer
