import { binToHex } from '@alephium/web3'
import { ChainId, coalesceChainName } from '@alephium/wormhole-sdk'
import Dockerode, { Container } from 'dockerode'
import { getSignedVAA } from '../utils'
import { execSync } from 'child_process'
import { default as guardianDevnetConfig } from '../../../configs/guardian/devnet.json'

export const newGuardianSet = [
  '0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe',
  '0x88D7D8B32a9105d228100E72dFFe2Fae0705D31c',
  '0x58076F561CC62A47087B567C86f986426dFCD000'
]
export const newGuardianSetIndex = 1
export const guardianSetIndexes = Array.from(newGuardianSet.keys())

export const docker = new Dockerode()
export const governanceChainId = guardianDevnetConfig.governanceChainId as ChainId
export const governanceEmitterAddress = guardianDevnetConfig.governanceEmitterAddress
export const guardianRpcPorts = [7071, 8071]

export async function getGuardianByIndex(index: number) {
  const containers = await docker.listContainers()
  const guardian = containers.find((c) => c.Names.some((name) => name.includes(`guardian-${index}`)))
  if (guardian === undefined) {
    throw new Error(`Guardian ${index} does not exist`)
  }
  return docker.getContainer(guardian.Id)
}

export async function runCmdInContainer(container: Container, cmd: string[], workDir: string) {
  console.log(`Executing ${cmd.join(' ')} on container ${container.id}, working dir: ${workDir}`)
  const exec = await container.exec({
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    Cmd: cmd,
    WorkingDir: workDir
  })
  const execOpts = { Detach: false, Tty: false, stream: true, stdin: true, stdout: true, stderr: true }
  const stream = await exec.start(execOpts)
  return new Promise<Buffer>((resolve, reject) => {
    const bufs: Buffer[] = []
    stream.on('data', (chunk) => bufs.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(bufs)))
    stream.on('error', (err) => reject(`Stream error: ${err}`))
  })
}

export function getNextGovernanceSequence() {
  const command = `npm --prefix ../clients/js start -- get-next-governance-sequence -n devnet -u http://127.0.0.1:8100`
  const output = execSync(command)
  const numberStr = output.toString('utf8').slice(output.lastIndexOf(':') + 2)
  return parseInt(numberStr)
}

export async function injectVAA(vaa: string, guardianIndex: number, fileName: string) {
  const container = await getGuardianByIndex(guardianIndex)
  await runCmdInContainer(container, ['bash', '-c', `echo '${vaa}' > ${fileName}`], '/')
  await runCmdInContainer(
    container,
    ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
    '/'
  )
}

export async function submitGovernanceVAA(
  action: string,
  sequence: number,
  toChainId: ChainId,
  targetChainIds?: ChainId[]
) {
  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterAddress, toChainId, sequence)
  const signedVaaHex = binToHex(signedVaa)
  console.log(`${action} signed vaa: ${signedVaaHex}`)

  const chainIds = targetChainIds ?? [toChainId]
  for (const chainId of chainIds) {
    const chain = coalesceChainName(chainId)
    const command = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -c ${chain} -n devnet`
    console.log(`Submitting ${action} signed vaa to ${chain}`)
    execSync(command)
  }
}
