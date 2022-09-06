import { Project, Script } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import * as dotenv from "dotenv"
import { getDevnetTokenBridgeId } from "./devnet"

dotenv.config({ path: __dirname+'/../../.env' })

const oneAlph = BigInt("1000000000000000000")

async function registerWithVAA(deployer: Deployer, script: Script, tokenBridge: string, vaa: string) {
  const initFields = {
    "payer": deployer.account.address,
    "tokenBridge": tokenBridge,
    "vaa": vaa,
    "alphAmount": oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initFields
  })
}

const registerChain = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const tokenBridgeId = networkType === 'devnet'
    ? getDevnetTokenBridgeId(deployer)
    : deployer.getDeployContractResult("TokenBridge").contractId
  const script = Project.script("token_bridge_scripts/register_chain.ral")
  const registerETHVAA = process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, tokenBridgeId, registerETHVAA)
  const registerBSCVAA = process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, tokenBridgeId, registerBSCVAA)
}

export default registerChain
