import { NodeProvider } from '@alephium/web3'

const devnetGroupIndex = 0

async function mine(): Promise<void> {
  const nodeProvider = new NodeProvider('http://127.0.0.1:22973')
  const chainIndex = {
    fromGroup: devnetGroupIndex,
    toGroup: devnetGroupIndex
  }
  await nodeProvider.miners.postMinersCpuMiningMineOneBlock(chainIndex)
  const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo(chainIndex)
  console.log(`chain index: ${chainIndex.fromGroup} -> ${chainIndex.toGroup}, height: ${chainInfo.currentHeight}`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await mine()
}

mine()
