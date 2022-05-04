import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { TerraTokenMap } from "../hooks/useTerraTokenMap";
import { MarketsMap } from "../hooks/useMarketsMap";
import {
  DataWrapper,
  errorDataWrapper,
  fetchDataWrapper,
  getEmptyDataWrapper,
  receiveDataWrapper,
} from "./helpers";

export interface TokenMetadataState {
  terraTokenMap: DataWrapper<TerraTokenMap>; //TODO make a decent type for this.
  marketsMap: DataWrapper<MarketsMap>;
}

const initialState: TokenMetadataState = {
  terraTokenMap: getEmptyDataWrapper(),
  marketsMap: getEmptyDataWrapper(),
};

export const tokenSlice = createSlice({
  name: "tokenInfos",
  initialState,
  reducers: {
    receiveTerraTokenMap: (state, action: PayloadAction<TerraTokenMap>) => {
      state.terraTokenMap = receiveDataWrapper(action.payload);
    },
    fetchTerraTokenMap: (state) => {
      state.terraTokenMap = fetchDataWrapper();
    },
    errorTerraTokenMap: (state, action: PayloadAction<string>) => {
      state.terraTokenMap = errorDataWrapper(action.payload);
    },

    receiveMarketsMap: (state, action: PayloadAction<MarketsMap>) => {
      state.marketsMap = receiveDataWrapper(action.payload);
    },
    fetchMarketsMap: (state) => {
      state.marketsMap = fetchDataWrapper();
    },
    errorMarketsMap: (state, action: PayloadAction<string>) => {
      state.marketsMap = errorDataWrapper(action.payload);
    },

    reset: () => initialState,
  },
});

export const {
  receiveTerraTokenMap,
  fetchTerraTokenMap,
  errorTerraTokenMap,
  receiveMarketsMap,
  fetchMarketsMap,
  errorMarketsMap,
  reset,
} = tokenSlice.actions;

export default tokenSlice.reducer;
