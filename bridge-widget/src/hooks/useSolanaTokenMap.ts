import { Dispatch } from '@reduxjs/toolkit'
// import { ENV, TokenInfo, TokenListProvider } from "@solana/spl-token-registry";
import { TokenInfo } from '../utils/solana'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DataWrapper } from '../store/helpers'
import { selectSolanaTokenMap } from '../store/selectors'
import { fetchSolanaTokenMap } from '../store/tokenSlice'

const useSolanaTokenMap = (): DataWrapper<TokenInfo[]> => {
  const tokenMap = useSelector(selectSolanaTokenMap)
  const dispatch = useDispatch()
  const shouldFire = tokenMap.data === undefined || (tokenMap.data === null && !tokenMap.isFetching)

  useEffect(() => {
    if (shouldFire) {
      getSolanaTokenMap(dispatch)
    }
  }, [dispatch, shouldFire])

  return tokenMap
}

const getSolanaTokenMap = (dispatch: Dispatch) => {
  dispatch(fetchSolanaTokenMap())

  // TODO: Uncomment when integrating Solana, removed to keep package size small
  // new TokenListProvider().resolve().then(
  //   (tokens) => {
  //     const tokenList = tokens.filterByChainId(getCluster() === "testnet" ? ENV.Testnet : ENV.MainnetBeta).getList();
  //     dispatch(receiveSolanaTokenMap(tokenList));
  //   },
  //   (error) => {
  //     console.error(error);
  //     dispatch(errorSolanaTokenMap("Failed to retrieve the Solana token map."));
  //   }
  // );
}

export default useSolanaTokenMap
