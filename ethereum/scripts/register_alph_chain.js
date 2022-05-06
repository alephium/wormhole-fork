// run this script with truffle exec

const jsonfile = require("jsonfile");
const TokenBridge = artifacts.require("TokenBridge");
const BridgeImplementationFullABI = jsonfile.readFileSync("../build/contracts/BridgeImplementation.json").abi

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();
        const initialized = new web3.eth.Contract(BridgeImplementationFullABI, TokenBridge.address);

        // Register the ALPH endpoint
        await initialized.methods.registerChain("0x01000000000100436bde20f0c53a5dc42fbb1864a9b64bd6a713fb0464a6d8019a05995f2f173a07852750da83dc7be6c3d96218377db19af31a4259dadf83188f0726c2ecc82500000000010000000100010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000546f6b656e427269646765010000000d448f46069b5c3afbe6f6a6f07ec57c58b9a1eb14a1d827b92b4bec64451f06f9").send({
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

