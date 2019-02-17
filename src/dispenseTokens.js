const hdkey = require('ethereumjs-wallet/hdkey');
const bip39 = require("bip39");
const { Tx, helpers, Output, Outpoint } = require('leap-core');
const poorManRpc = require('./utils/poorManRpc');

module.exports = async (requests, fetch, providerUrl, mnemonic) => {

  const rpc = poorManRpc(fetch, providerUrl);
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Bad Request: Mnemonic invalid or undefined");
  }
  const walletHdpath = "m/44'/60'/0'/0/";

  for (let request of requests) {

    const wallet = hdwallet.derivePath(walletHdpath + request.addressIndex).getWallet();
    const envelopeAddr = '0x' + wallet.getAddress().toString('hex');

    // calc inputs
    // TODO: filter here
    const utxos = (await rpc("plasma_unspent", [envelopeAddr]))
      .map(u => ({
        output: u.output,
        outpoint: Outpoint.fromRaw(u.outpoint),
      }));

    if (utxos.length === 0) {
      throw new Error("No tokens in the envelope");
    }

    const inputs = helpers.calcInputs(utxos, envelopeAddr, request.amount, request.color);

    // create change output if needed
    let outputs = helpers.calcOutputs(utxos, inputs, envelopeAddr, envelopeAddr, request.amount, request.color);
    if (outputs.length > 1) { // if we have change output
      outputs = outputs.splice(-1); // leave only change
    } else {
      outputs = [];
    }

    // add output for each faucet request
    outputs.push(new Output(request.amount, request.claimantAddr, request.color));
    
    const priv = wallet.getPrivateKeyString();
    const tx = Tx.transfer(inputs, outputs).signAll(priv);

    // eslint-disable-next-line no-console
    await rpc("eth_sendRawTransaction", [tx.hex()]);
  }

}