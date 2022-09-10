// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync(
  "../build/contracts/BridgeImplementation.json"
).abi;
const alphTokenBridgeVAA = process.env.REGISTER_ALPH_TOKEN_BRIDGE_VAA;

console.log("alphTokenBridgeVAA", alphTokenBridgeVAA)

module.exports = async function(callback) {
  try {
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
      BridgeImplementationFullABI,
      TokenBridge.address
    );

    // Register the alephium endpoint
    await initialized.methods
      .registerChain("0x" + alphTokenBridgeVAA)
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });

    callback();
  } catch (e) {
    callback(e);
  }
};
