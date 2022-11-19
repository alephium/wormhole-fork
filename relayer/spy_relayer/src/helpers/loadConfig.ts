import { config } from "dotenv";
const configFile: string = process.env.SPY_RELAY_CONFIG
  ? process.env.SPY_RELAY_CONFIG
  : ".env.sample";
console.log(`Loading config file [${configFile}]`);
config({ path: configFile });
export {};
