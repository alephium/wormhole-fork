// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x01000000000100e34d13a7f90f6c47dd0d2ddf65095f2203e20ddecf537e3d8b5ba39d7de682bf567fa8b91e8b11fecc38ac99b439370f20d9e8969be71996970a4197deeebd6b000000000100000001000100000000000000000000000000000000000000000000000000000000000000040000000002c8bb0600000000000000000000000000000000000000000000546f6b656e427269646765010000000ddeae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07").send({
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

