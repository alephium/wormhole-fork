// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x01000000000100688b32b1443691900b55a6b789180fc69d32c04a9a82205111645dba5cfe5cc707da4b35945616b3b512486ad35a96409b4670d71e50542922a43e43c2e5231b000000000100000001000100000000000000000000000000000000000000000000000000000000000000040000000002c8bb0600000000000000000000000000000000000000000000546f6b656e427269646765010000000de464b022a467495a52ab8a31012a2345bbb463c5394efaa59c7690d3c76b35cf").send({
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

