#!/usr/bin/env node
import { Project, setCurrentNodeProvider } from "@alephium/web3"
import { program } from "commander"
import { run as runJestTests } from "jest"
import fs from "fs"
import { Configuration, deploy, NetworkType } from "./lib/deployment"
import path from "path"

program.command("test")
  .description("Test the contracts")
  .option("-p, --path <test-dir-path>", "Test directory path", "test")
  .option("-f, --file <test-file>", "Test only one file")
  .option("-g, --grep <pattern>", "Run only tests with a name that matches the regex pattern")
  .option("-i, --runInBand", "Run all tests serially in the current process", false)
  .option("-v, --verbose", "Display individual test results with the test suite hierarchy", false)
  .option("-s, --silent", "Prevent tests from printing messages through the console", false)
  .action(async (options) => {
    const jestOptions: string[] = []
    const testPath = options.path as string
    const jestConfig = {
      transform: {
        "^.+\\.(t|j)sx?$": "ts-jest"
      },
      testRegex: `(/${testPath}/(?!fixtures).*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$`
    }
    const jestConfigStr = JSON.stringify(jestConfig)

    if (options.file) {
      jestOptions.push(options.file as string)
    }
    if (options.grep) {
      jestOptions.push("-t", options.grep as string)
    }
    if (options.runInBand) {
      jestOptions.push("-i")
    }
    if (options.verbose) {
      jestOptions.push("--verbose")
    }
    if (options.silent) {
      jestOptions.push("--silent")
    }
    jestOptions.push("--config", jestConfigStr, "--detectOpenHandles", "--useStderr")
    await runJestTests(jestOptions)
  })

program.command("compile")
  .description("Compile the project")
  .option("-n, --nodeUrl <node-url>", "Alephium full node url", "http://127.0.0.1:22973")
  .option("-c, --contractPath <contract-dir-path>", "Contract directory path", "contracts")
  .option("-a, --artifactPath <artifact-dir-path>", "Artifact directory path", "artifacts")
  .action(async (options) => {
    const nodeProvider = options.nodeUrl as string
    setCurrentNodeProvider(nodeProvider)
    const contractPath = options.contractPath as string
    const artifactPath = options.artifactPath as string
    await Project.build(contractPath, artifactPath)
    console.log("Compile completed!")
  })

program.command("deploy")
  .description("Deploy contracts")
  .option("-c, --config <config-file>", "Deployment config file", "configuration.ts")
  .option("-n, --network <network-type>", "Specify the network to use")
  .action(async (options) => {
    const configPath = options.config as string
    if (!fs.existsSync(configPath)) {
      program.error(`${configPath} does not exist`)
    }
    let config: Configuration
    try {
      const content = require(path.resolve(configPath))
      if (content.default) {
        config = content.default as Configuration
      } else {
        program.error(`no default configuration exported from ${configPath}`)
      }
    } catch (error) {
      program.error(`failed to read config file, error: ${error}`)
    }
    await deploy(config, options.network as NetworkType)
  })

// TODO: use SDK `start-devnet/stop-devnet` scripts
program.command("node")
  .description("Setup devnet")
  .option("--stop")
  .option("--start")

program.parseAsync(process.argv)
