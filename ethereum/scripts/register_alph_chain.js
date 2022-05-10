// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x01000000000100f8f4b7da2bdd35242e78f7121d772b7244ba915c8b1b30f876335484aa62e3cc64303d975e59da69d3954f974da4d39f3e228d60e1df9e121f5da30ecfcf28cc00000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e427269646765010000000d685a6fea3a94e63614c8dd8596a8ecb706153a397620b4c0e0c4a7b5d0a7778d").send({
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

