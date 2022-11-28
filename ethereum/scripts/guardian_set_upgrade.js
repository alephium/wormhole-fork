// run this script with truffle exec

const jsonfile = require("jsonfile");
const Wormhole = artifacts.require("Wormhole");
const ImplementationFullABI = jsonfile.readFileSync(
    "../build/contracts/Implementation.json"
).abi;
const guardianSetUpgradeVAA = process.env.GUARDIAN_SET_UPGRADE_VAA;

module.exports = async function (callback) {
  try {
    if (guardianSetUpgradeVAA) {
      const accounts = await web3.eth.getAccounts();
      const wormhole = new web3.eth.Contract(ImplementationFullABI, Wormhole.address);
      await wormhole.methods
        .submitNewGuardianSet("0x" + guardianSetUpgradeVAA)
        .send({
          value: 0,
          from: accounts[0],
          gasLimit: 2000000,
        });
    }

    callback();
  }
  catch (e) {
    callback(e);
  }
}
