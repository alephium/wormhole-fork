import { CHAIN_ID_ALEPHIUM, getLocalTokenInfo } from '@alephium/wormhole-sdk'
import { formatUnits } from 'ethers/lib/utils'
import { useCallback } from 'react'
import { createParsedTokenAccount } from '../../hooks/useGetSourceParsedTokenAccounts'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import { ParsedTokenAccount } from '../../store/transferSlice'
import { getAlephiumTokenLogoAndSymbol, tryGetContractId } from '../../utils/alephium'
import TokenPicker, { BasicAccountRender } from '../TokenSelectors/TokenPicker'
import { useWallet } from '@alephium/web3-react'
import { useTranslation } from 'react-i18next'
import TokenPicker2 from './TokenPicker2'

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null
  balances: Map<string, bigint>
  onChange: (newValue: ParsedTokenAccount | null) => void
  tokens: ParsedTokenAccount[] | undefined
  isFetching: boolean
  disabled: boolean
  resetAccounts: (() => void) | undefined
}

const returnsFalse = () => false

export default function AlephiumTokenPicker2(props: AlephiumTokenPickerProps) {
  const { t } = useTranslation()
  const { value, balances, onChange, disabled, tokens, isFetching, resetAccounts } = props
  const alphWallet = useWallet()
  const { isReady } = useIsWalletReady(CHAIN_ID_ALEPHIUM)

  const resetAccountWrapper = useCallback(() => {
    resetAccounts && resetAccounts()
  }, [resetAccounts])
  const isLoading = isFetching

  const onChangeWrapper = useCallback(
    async (account: ParsedTokenAccount | null) => {
      if (account === null) {
        onChange(null)
        return Promise.resolve()
      }
      onChange(account)
      return Promise.resolve()
    },
    [onChange]
  )

  const getAddress: (address: string, tokenId?: string) => Promise<ParsedTokenAccount> = useCallback(
    async (address: string, tokenId?: string) => {
      if (isReady && alphWallet.connectionStatus === 'connected' && alphWallet.nodeProvider !== undefined) {
        try {
          const contractId = tryGetContractId(address)
          const tokenInfo = await getLocalTokenInfo(alphWallet.nodeProvider, contractId)
          const logoAndSymbol = await getAlephiumTokenLogoAndSymbol(contractId)
          const amount = balances.get(contractId.toLowerCase()) ?? BigInt(0)
          const uiAmount = formatUnits(amount, tokenInfo.decimals)
          return createParsedTokenAccount(
            alphWallet.account.address,
            contractId,
            amount.toString(),
            tokenInfo.decimals,
            parseFloat(uiAmount),
            uiAmount,
            logoAndSymbol?.symbol ?? tokenInfo.symbol,
            tokenInfo.name,
            logoAndSymbol?.logoURI,
            false
          )
        } catch (e) {
          return Promise.reject(t('Unable to retrive the specific token.'))
        }
      } else {
        return Promise.reject({ error: t('Wallet is not connected.') })
      }
    },
    [isReady, alphWallet, balances, t]
  )

  const isSearchableAddress = useCallback((address: string) => {
    try {
      tryGetContractId(address)
      return true
    } catch (error) {
      return false
    }
  }, [])

  const RenderComp = useCallback(({ account }: { account: ParsedTokenAccount }) => {
    return BasicAccountRender(account, returnsFalse, false)
  }, [])

  return (
    <TokenPicker2
      value={value}
      options={tokens || []}
      RenderOption={RenderComp}
      onChange={onChangeWrapper}
      isValidAddress={isSearchableAddress}
      getAddress={getAddress}
      disabled={disabled}
      resetAccounts={resetAccountWrapper}
      error={''}
      showLoader={isLoading}
      nft={false}
      chainId={CHAIN_ID_ALEPHIUM}
    />
  )
}
