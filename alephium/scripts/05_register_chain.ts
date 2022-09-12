import { Project, Script } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../../.env' })

const oneAlph = BigInt("1000000000000000000")

async function registerWithVAA(
  deployer: Deployer,
  script: Script,
  tokenBridge: string,
  vaa: string,
  taskName: string
) {
  const initialFields = {
    "payer": deployer.account.address,
    "tokenBridge": tokenBridge,
    "vaa": vaa,
    "alphAmount": oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  }, taskName)
}

const registerChain = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const tokenBridgeId = deployer.getDeployContractResult("TokenBridge").contractId
  const script = Project.script("RegisterChain")
  const registerETHVAA = process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, tokenBridgeId, registerETHVAA, "ETH")
  const registerBSCVAA = process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!
  await registerWithVAA(deployer, script, tokenBridgeId, registerBSCVAA, "BSC")
}

export default registerChain
