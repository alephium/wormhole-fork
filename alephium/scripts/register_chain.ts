import { Project, Script } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../../.env' })

const oneAlph = BigInt("1000000000000000000")

async function registerWithVAA(deployer: Deployer, script: Script, vaa: string) {
  const initFields = {
    "payer": deployer.account.address,
    "tokenBridge": deployer.getEnvironment("TokenBridge"),
    "vaa": vaa,
    "alphAmount": oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initFields
  })
}

const registerChain = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const script = Project.script("token_bridge_scripts/register_chain.ral")
  const registerETHVAA = process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, registerETHVAA)
  const registerBSCVAA = process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, registerBSCVAA)
}

export default registerChain
