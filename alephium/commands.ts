#!/usr/bin/env node
import { Project, web3 } from '@alephium/web3'
import { program } from 'commander'
import { run as runJestTests } from 'jest'
import { deploy, loadConfig, NetworkType } from './lib/deployment'

program
  .command('test')
  .description('Test the contracts')
  .option('-p, --path <test-dir-path>', 'Test directory path', 'test')
  .option('-f, --file <test-file>', 'Test only one file')
  .option('-g, --grep <pattern>', 'Run only tests with a name that matches the regex pattern')
  .option('-i, --runInBand', 'Run all tests serially in the current process', false)
  .option('-v, --verbose', 'Display individual test results with the test suite hierarchy', false)
  .option('-s, --silent', 'Prevent tests from printing messages through the console', false)
  .action(async (options) => {
    const jestOptions: string[] = []
    const testPath = options.path as string
    const jestConfig = {
      transform: {
        '^.+\\.(t|j)sx?$': 'ts-jest'
      },
      testRegex: `(/${testPath}/(?!fixtures).*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$`
    }
    const jestConfigStr = JSON.stringify(jestConfig)

    if (options.file) {
      jestOptions.push(options.file as string)
    }
    if (options.grep) {
      jestOptions.push('-t', options.grep as string)
    }
    if (options.runInBand) {
      jestOptions.push('-i')
    }
    if (options.verbose) {
      jestOptions.push('--verbose')
    }
    if (options.silent) {
      jestOptions.push('--silent')
    }
    jestOptions.push('--config', jestConfigStr, '--detectOpenHandles', '--useStderr')
    await runJestTests(jestOptions)
  })

program
  .command('compile')
  .description('Compile the project')
  .option('-c, --config <config-file>', 'Build config file', 'configuration.ts')
  .option('-n, --network <network-type>', 'Network type')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config as string)
      const networkType = options.network ? (options.network as NetworkType) : config.defaultNetwork
      const nodeUrl = config.networks[networkType].nodeUrl
      web3.setCurrentNodeProvider(nodeUrl)
      await Project.build(config.compilerOptions, config.sourcePath, config.artifactPath)
      console.log('Compile completed!')
    } catch (error) {
      program.error(`${error}`)
    }
  })

program
  .command('deploy')
  .description('Deploy contracts')
  .option('-c, --config <config-file>', 'Deployment config file', 'configuration.ts')
  .option('-n, --network <network-type>', 'Specify the network to use')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config as string)
      const networkType = options.network ? (options.network as NetworkType) : config.defaultNetwork
      await deploy(config, networkType)
    } catch (error) {
      program.error(`${error}`)
    }
  })

// TODO: use SDK `start-devnet/stop-devnet` scripts
program.command('node').description('Setup devnet').option('--stop').option('--start')

program.parseAsync(process.argv)
