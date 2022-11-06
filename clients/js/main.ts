#!/usr/bin/env node
import yargs from "yargs";

import { hideBin } from "yargs/helpers";

import { setDefaultWasm, getSignedVAAWithRetry, ChainId } from "alephium-wormhole-sdk";
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { execute_governance_solana } from "./solana";
import { execute_governance_evm } from "./evm";
import { execute_governance_terra } from "./terra";
import * as vaa from "./vaa";
import { impossible, Payload, serialiseVAA, VAA } from "./vaa";
import {
  assertChain,
  ChainName,
  CHAINS,
  toChainName,
  isEVMChain,
  toChainId,
} from "alephium-wormhole-sdk";
import { execute_governance_alph } from "./alph";

setDefaultWasm("node");

const GOVERNANCE_CHAIN = 1;
const GOVERNANCE_EMITTER =
  "0000000000000000000000000000000000000000000000000000000000000004";

async function makeVAA(
  emitterChain: number,
  targetChain: number,
  emitterAddress: string,
  signers: string[],
  keyNames: string[],
  sequence: string | undefined,
  p: Payload,
  useKMS: boolean
): Promise<VAA<Payload>> {
  let v: VAA<Payload> = {
    version: 1,
    guardianSetIndex: 0,
    signatures: [],
    timestamp: 1,
    nonce: 1,
    emitterChain: emitterChain,
    targetChain: targetChain,
    emitterAddress: emitterAddress,
    sequence: typeof sequence === 'undefined' ? BigInt(Math.floor(Math.random() * 100000000)) : BigInt(sequence),
    consistencyLevel: 0,
    payload: p,
  };

  if (useKMS) {
    v.signatures = await vaa.signWithKMS(keyNames, v);
  } else {
    v.signatures = vaa.signWithKey(signers, v);
  }

  return v;
}

yargs(hideBin(process.argv))
  ////////////////////////////////////////////////////////////////////////////////
  // Generate
  .command(
    "generate",
    "generate VAAs (devnet and testnet only)",
    (yargs) => {
      return (
        yargs
          .option("guardian-secret", {
            alias: "g",
            required: false,
            describe: "Guardians' secret keys",
            default: "",
            type: "string",
          })
          .option("guardian-key-name", {
            alias: "j",
            required: false,
            describe: "Guardians' KMS key names",
            default: "",
            type: "string",
          })
          .option("sequence", {
            alias: "s",
            required: false,
            describe: "VAA sequence",
            type: "string",
          })
          .option("use-kms", {
            alias: "k",
            required: false,
            describe: "If KMS should be used",
            type: "boolean",
          })
          // Registration
          .command(
            "registration",
            "Generate registration VAA",
            (yargs) => {
              return yargs
                .option("chain", {
                  alias: "c",
                  describe: "Chain to register",
                  type: "string",
                  // choices: Object.keys(CHAINS), TODO: remove the comment once we release our sdk
                  required: true,
                })
                .option("contract-address", {
                  alias: "a",
                  describe: "Contract to register",
                  type: "string",
                  required: true,
                })
                .option("module", {
                  alias: "m",
                  describe: "Module to upgrade",
                  type: "string",
                  choices: ["NFTBridge", "TokenBridge"],
                  required: true,
                })
            },
            (argv) => {
              const module = argv["module"] as "NFTBridge" | "TokenBridge";
              assertChain(argv["chain"])
              const emitterChainId = toChainId(argv["chain"])
              const payload: vaa.PortalRegisterChain<typeof module> = {
                module,
                type: "RegisterChain",
                emitterChain: emitterChainId,
                emitterAddress: Buffer.from(
                  argv["contract-address"].padStart(64, "0"),
                  "hex"
                ),
              };
              makeVAA(
                GOVERNANCE_CHAIN,
                0,
                GOVERNANCE_EMITTER,
                argv["guardian-secret"].split(","),
                argv["guardian-key-name"].split(","),
                argv["sequence"],
                payload,
                !!argv["use-kms"]
              ).then((v) =>
                console.log(serialiseVAA(v))
              );
            }
          )
          // Upgrade
          .command(
            "upgrade",
            "Generate contract upgrade VAA",
            (yargs) => {
              return yargs
                .option("chain", {
                  alias: "c",
                  describe: "Chain to upgrade",
                  type: "string",
                  choices: Object.keys(CHAINS),
                  required: true,
                })
                .option("contract-address", {
                  alias: "a",
                  describe: "Contract to upgrade to",
                  type: "string",
                  required: true,
                })
                .option("module", {
                  alias: "m",
                  describe: "Module to upgrade",
                  type: "string",
                  choices: ["Core", "NFTBridge", "TokenBridge"],
                  required: true,
                });
            },
            (argv) => {
              assertChain(argv["chain"]);
              const module = argv["module"] as
                | "Core"
                | "NFTBridge"
                | "TokenBridge";
              const address = Buffer.from(argv["contract-address"].padStart(64, "0"), "hex")
              const payload = vaa.contractUpgradeVAA(module, address)
              makeVAA(
                GOVERNANCE_CHAIN,
                toChainId(argv["chain"]),
                GOVERNANCE_EMITTER,
                argv["guardian-secret"].split(","),
                argv["guardian-key-name"].split(","),
                argv["sequence"],
                payload,
                !!argv["use-kms"]
              ).then((v) => {
                console.log(serialiseVAA(v));
              });
            }
          )
          // Update guardian set
          .command(
            'update-guardian-set',
            'Generate update guardian set vaa',
            (yargs) => {
              return yargs
                .option('index', {
                  alias: 'i',
                  describe: 'New guardian set index',
                  type: 'number',
                  required: true,
                })
                .option('keys', {
                  alias: 'k',
                  describe: 'New guardian set keys',
                  type: 'string',
                  required: true
                })
            },
            (argv) => {
              const sequence = argv['sequence']
              if (sequence === undefined) {
                exitOnError('sequence is required for this command')
              }
              const index = argv['index']
              const keys = argv['keys'].split(',').map(key => {
                if (key.startsWith('0x') || key.startsWith('0X')) {
                  return key.slice(2)
                }
                return key
              })
              if (keys.length === 0) {
                throw new Error('new guardian set cannot be empty')
              }
              const payload: vaa.GuardianSetUpgrade = {
                module: 'Core',
                type: 'GuardianSetUpgrade',
                newGuardianSetIndex: index,
                newGuardianSetLength: keys.length,
                newGuardianSet: keys
              }
              makeVAA(
                GOVERNANCE_CHAIN,
                0,
                GOVERNANCE_EMITTER,
                argv["guardian-secret"].split(","),
                argv["guardian-key-name"].split(","),
                sequence,
                payload,
                !!argv["use-kms"]
              ).then((v) => {
                console.log(serialiseVAA(v));
              });
            }
          )
      );
    },
    (_) => {
      yargs.showHelp();
    }
  )
  .command(
    'fetch',
    'Fetch a signed VAA from given VAA ID',
    (yargs) => {
      return yargs
        .option('id', {
          describe: 'VAA ID (emitterChainId/emitterAddress/targetChainId/sequence)',
          type: 'string',
          required: true
        })
        .option('url', {
          describe: 'url, e.g. http://localhost:7071',
          type: 'string',
          required: true
        })
        .option('timeout', {
          describe: 'timeout in seconds',
          type: 'number'
        })
        .option('times', {
          describe: 'retry times',
          type: 'number'
        })
    },
    async (argv) => {
      const parts = argv.id.split('/')
      if (parts.length !== 4) {
        throw Error('Invalid VAA ID')
      }
      const response = await getSignedVAAWithRetry(
        [argv.url],
        parseInt(parts[0]) as ChainId,
        parts[1],
        parseInt(parts[2]) as ChainId,
        parts[3],
        { transport: NodeHttpTransport() },
        (argv.timeout ?? 5) * 1000,
        argv.times ?? 3
      )
      console.log(`Signed VAA: ${Buffer.from(response.vaaBytes).toString('hex')}`)
    }
  )
  ////////////////////////////////////////////////////////////////////////////////
  // Parse
  .command(
    "parse <vaa>",
    "Parse a VAA",
    (yargs) => {
      return yargs.positional("vaa", {
        describe: "vaa",
        type: "string",
      });
    },
    async (argv) => {
      const buf = Buffer.from(String(argv.vaa), "hex");
      const parsed_vaa = vaa.parse(buf);
      console.log(parsed_vaa);
    }
  )
  ////////////////////////////////////////////////////////////////////////////////
  // Submit
  .command(
    "submit <vaa>",
    "Execute a VAA",
    (yargs) => {
      return yargs
        .positional("vaa", {
          describe: "vaa",
          type: "string",
          required: true,
        })
        .option("chain", {
          alias: "c",
          describe: "chain name",
          type: "string",
          choices: Object.keys(CHAINS),
          required: false,
        })
        .option("network", {
          alias: "n",
          describe: "network",
          type: "string",
          choices: ["mainnet", "testnet", "devnet"],
          required: true,
        });
    },
    async (argv) => {
      const vaa_hex = String(argv.vaa);
      const buf = Buffer.from(vaa_hex, "hex");
      const parsed_vaa = vaa.parse(buf);

      if (!vaa.hasPayload(parsed_vaa)) {
        throw Error("Couldn't parse VAA payload");
      }

      console.log(parsed_vaa.payload);

      const network = argv.network.toUpperCase();
      if (
        network !== "MAINNET" &&
        network !== "TESTNET" &&
        network !== "DEVNET"
      ) {
        throw Error(`Unknown network: ${network}`);
      }

      // We figure out the target chain to submit the VAA to.
      // The VAA might specify this itself (for example a contract upgrade VAA
      // or a token transfer VAA), in which case we just submit the VAA to
      // that target chain.
      //
      // If the VAA does not have a target (e.g. chain registration VAAs or
      // guardian set upgrade VAAs), we require the '--chain' argument to be
      // set on the command line.
      //
      // As a sanity check, in the event that the VAA does specify a target
      // and the '--chain' argument is also set, we issue an error if those
      // two don't agree instead of silently taking the VAA's target chain.

      // get VAA chain
      const vaa_chain_id = parsed_vaa.targetChain;
      assertChain(vaa_chain_id);
      const vaa_chain = toChainName(vaa_chain_id);

      // get chain from command line arg
      const cli_chain = argv["chain"];

      let chain: ChainName;
      if (cli_chain !== undefined) {
        assertChain(cli_chain);
        if (vaa_chain !== "unset" && cli_chain !== vaa_chain) {
          throw Error(
            `Specified target chain (${cli_chain}) does not match VAA target chain (${vaa_chain})`
          );
        }
        chain = cli_chain;
      } else {
        chain = vaa_chain;
      }

      if (chain === "unset") {
        throw Error(
          "This VAA does not specify the target chain, please provide it by hand using the '--chain' flag."
        );
      } else if (isEVMChain(chain)) {
        await execute_governance_evm(parsed_vaa.payload, buf, network, chain);
      } else if (chain === "terra") {
        await execute_governance_terra(parsed_vaa.payload, buf, network);
      } else if (chain === "solana") {
        await execute_governance_solana(parsed_vaa, buf, network);
      } else if (chain === "algorand") {
        throw Error("Algorand is not supported yet");
      } else if (chain === "near") {
        throw Error("NEAR is not supported yet");
      } else if (chain === "alephium") {
        await execute_governance_alph(parsed_vaa.payload, buf, network)
      } else {
        // If you get a type error here, hover over `chain`'s type and it tells you
        // which cases are not handled
        impossible(chain);
      }
    }
  ).argv

function exitOnError(msg: string) {
  console.log(msg)
  process.exit(1)
}
