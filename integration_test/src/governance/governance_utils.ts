import Dockerode, { Container } from 'dockerode'

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
