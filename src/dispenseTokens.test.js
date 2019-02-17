const { it, describe } = require('mocha');
const fetch = require('node-fetch');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const sinon = require('sinon');
const dispenseTokens = require('./dispenseTokens');

chai.use(sinonChai);

const ADDR = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
const MNEMONIC = 'unable drop gospel simple danger elbow brand head shrug cereal lens grain';
const UNSPENTS = {
  json() {
    return { "jsonrpc":"2.0","id":1,"result":[{"outpoint":"0xea8397ef431ee361b8cf724d734266e2b7af1ebca4e81ad6d69fac906a2615d000","output":{"address":"0x27f748becc70b70e81177266a55c1c93738a2b07","value":"500000000000000000","color":0}},{"outpoint":"0x93f35458993de3ae8021275e639d900d7a927014e9df2cf646f7f96f466f725901","output":{"address":"0x27f748becc70b70e81177266a55c1c93738a2b07","value":"1000000000000000000","color":0}}]}
  }
};

describe('DispenseTokens', () => {

  it('should send some transaction', async () => {

    sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));

    await dispenseTokens([{
      claimantAddr: ADDR,
      addressIndex: 3,
      color: 0,
      amount: '130000000000000',
    }], fetch, null, MNEMONIC);


  });


  afterEach(() => {
    if (fetch.Promise.restore) fetch.Promise.restore();
  });
});
