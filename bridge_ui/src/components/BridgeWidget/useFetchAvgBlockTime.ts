import { useWallet } from '@alephium/web3-react'
import { useEffect, useState } from 'react'

const useFetchAvgBlockTime = () => {
  const alphWallet = useWallet()
  const [avgBlockTime, setAvgBlockTime] = useState<number>(0)

  useEffect(() => {
    alphWallet?.explorerProvider?.infos.getInfosAverageBlockTimes().then((data) => {
      if (data && data.length > 0)
        setAvgBlockTime(data.reduce((acc: number, { value }) => acc + value, 0.0) / data.length)
    })
  }, [alphWallet])

  return avgBlockTime
}

export default useFetchAvgBlockTime
