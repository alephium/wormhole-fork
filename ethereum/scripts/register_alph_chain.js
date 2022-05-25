// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x0100000000010071aeddd7838cc10746b579706443b0c158a0f594b6e82592f1ff8f6e0f909d94489c4907f133430de22ef2248f98005dff57f7ce87fd0e277162d88244d1687800000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e427269646765010000000d068bc98d8a7ac5f72a799fa44477867b5b74826f8de54d8fc5db0f7452761691").send({
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

