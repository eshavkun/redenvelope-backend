const hdkey = require('ethereumjs-wallet/hdkey');
const bip39 = require("bip39");
const random = require('random');
const seedrandom = require('seedrandom');
const { isValidAddress } = require('ethereumjs-util');
const JSBI = require('jsbi');
const poorManRpc = require('./utils/poorManRpc');

function getShare(seed, numRecipients, size, index) {
  random.use(seedrandom(seed));

  let cuts = [];
  for (let i=0; i<numRecipients-1; i++) {
    let cut = random.int(min = 1, max = 99);
    while(cuts.includes(cut)) {
      cut = random.int(min = 1, max = 99);
    }
    cuts.push(cut);
  }
  cuts.push(0);
  cuts.push(100);
  cuts = cuts.sort((a, b) => a-b);

  let shares = cuts.reduce((acc, cv, ix, arr) => {
    if (ix !== arr.length-1) {
      acc.push(arr[ix+1] - cv);
      return acc;
    } else {
      return acc;
    }
  }, []).sort((a, b) => a-b);
  
  const unit = JSBI.divide(size, JSBI.BigInt(100));
  const share = JSBI.multiply(unit, JSBI.BigInt(shares[index]));
  return share;
}

module.exports = class EnvelopeHandler {

  constructor(queue, db, mnemonic, providerUrl, fetch) {
    this.queue = queue;
    this.db = db;
    this.mnemonic = mnemonic;
    this.wallet_hdpath = "m/44'/60'/0'/0/";
    this.providerUrl = providerUrl;
    this.fetch = fetch;
  }

  async handleCreate(numRecepients, color, from) {
    // check that numRecepients < 16
    if (!isValidAddress(from)) {
      throw new Error(`Bad Request: Not a valid Ethereum address: ${from}`);
    }

    if(numRecepients > 16) {
      throw new Error(`Bad Request: Number of recipients cannot be > 16`);
    }

    if(numRecepients < 1) {
      throw new Error(`Bad Request: Number of recipients cannot be < 1`);
    }

    let addressIndex = await this.db.getCount();
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(this.mnemonic));

    if (!bip39.validateMnemonic(this.mnemonic)) {
      throw new Error("Bad Request: Mnemonic invalid or undefined");
    }

    const wallet = hdwallet.derivePath(this.wallet_hdpath + addressIndex).getWallet();
    const envelopeAddr = '0x' + wallet.getAddress().toString('hex');

    await this.db.setEnvelope(envelopeAddr, addressIndex, color, 0, [from], numRecepients);
    return {
      address: envelopeAddr
    };
  }

  async handleClaim(envelopeAddr, claimantAddr) {
    if (!isValidAddress(claimantAddr)) {
      throw new Error(`Bad Request: Not a valid Ethereum address: ${claimantAddr}`);
    }

    const envelope = await this.db.getEnvelope(envelopeAddr);
    const claimants = JSON.parse(envelope.claimants);

    if (claimants.indexOf(claimantAddr) > -1) {
      throw new Error("already claimed");
    }

    const rpc = poorManRpc(this.fetch, this.providerUrl);

    const response = await rpc("plasma_unspent", [envelopeAddr]);

    const balance = response.reduce((sum, unspent) => { 
        return (unspent.output.color === +envelope.color) ? JSBI.add(sum, JSBI.BigInt(unspent.output.value)) : sum}, JSBI.BigInt(0));

    if (JSBI.EQ(balance, JSBI.BigInt(0))) {
      throw new Error("Envelope depleted")
    }

    const maxAmount = JSBI.GE(balance, JSBI.BigInt(envelope.maxAmount)) ? balance : JSBI.BigInt(envelope.maxAmount);
    const claimantIndex = claimants.length-1; //Envelope creator is put as first claimant

    let share = balance;
    if (claimantIndex < +envelope.numRecepients) {
      share = getShare(envelopeAddr, +envelope.numRecepients, maxAmount, +claimantIndex);
    }
 
    claimants.push(claimantAddr);
    
    await this.db.updateEnvelope(envelopeAddr, claimants, maxAmount);
    if (JSBI.greaterThan(share, JSBI.BigInt(0))) {
      await this.queue.put(JSON.stringify({
        claimantAddr: claimantAddr,
        addressIndex: +envelope.envelopeIndex,
        color: +envelope.color,
        amount: share.toString(),
      }));
    }
    return {
      amount: share.toString()
    };
  }

}
