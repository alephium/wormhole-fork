#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from "yargs/helpers"

import configuration from "./configuration"
import { deploy, NetworkType } from "./lib/deployment"

const argv = yargs(hideBin(process.argv))
  .options("network", {
    choices: ["devnet", "testnet", "mainnet"] as const,
    alias: "n",
    required: true,
    describe: "Network Id",
    type: 'string'
  })
  .options("reset", {
    default: false,
    required: false,
    describe: "Reset",
    type: 'boolean'
  })
  .argv

async function deployWormhole() {
  const params = await argv
  await deploy(configuration, params.network as NetworkType, params.reset)
}

deployWormhole()
