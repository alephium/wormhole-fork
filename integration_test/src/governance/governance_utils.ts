import { binToHex } from '@alephium/web3'
import { ChainId, coalesceChainName } from 'alephium-wormhole-sdk'
import Dockerode, { Container } from 'dockerode'
import { getSignedVAA } from '../utils'
import { execSync } from 'child_process'

export const docker = new Dockerode()
export const governanceChainId = 1
export const governanceEmitterId = '0000000000000000000000000000000000000000000000000000000000000004'
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

export async function getNextGovernanceSequence() {
  const container = await getGuardianByIndex(0)
  const output = await runCmdInContainer(
    container,
    ['bash', '-c', `./guardiand admin get-next-governance-vaa-sequence --socket /tmp/admin.sock`],
    '/'
  )
  const strs = output.toString('utf8').split(' ')
  return parseInt(strs[strs.length - 1])
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
  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, toChainId, sequence)
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
