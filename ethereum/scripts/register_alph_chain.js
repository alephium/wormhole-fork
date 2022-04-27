// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x010000000001000f75c5b3477d4647c584fa3b6ce1e50e41c4679b1dd0e148dc084a9f174d03ee21e4932a8dcec760dc76f90e0f0c01dd6ee1ca57fb9570368ce11fcb38b1d87301000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e427269646765010000000dbacf353868a9b9dbca71b1688c65c05752c0bfbf629fd1bee5473274fad37a2d").send({
            value: 0,
            from: accounts[0],
            gasLimit: 2000000
        });

        callback();
    }
    catch (e) {
        callback(e);
    }
}

