import { NodeProvider } from '@alephium/web3'

const devnetGroupIndex = 0
const chain00 = {
  fromGroup: devnetGroupIndex,
  toGroup: devnetGroupIndex
}

const nodeProvider = new NodeProvider(process.env.NODE_URL ?? 'http://127.0.0.1:22973')

async function mine(num: number): Promise<void> {
  await nodeProvider.miners.postMinersCpuMiningMineOneBlock(chain00)
  // mine other chains every 16 seconds
  if (num % 16 !== 0) {
    const n = num % 16
    const fromGroup = Math.floor(n / 4)
    const toGroup = n % 4
    const chainIndex = { fromGroup: fromGroup, toGroup: toGroup }
    await nodeProvider.miners.postMinersCpuMiningMineOneBlock(chainIndex)
  }
  const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo(chain00)
  console.log(`chain index: ${chain00.fromGroup} -> ${chain00.toGroup}, height: ${chainInfo.currentHeight}`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await mine(num + 1)
}

mine(0)
