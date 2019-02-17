const { it, describe, beforeEach } = require('mocha');
const fetch = require('node-fetch');
const chai = require('chai');
const { expect } = chai;
const sinonChai = require('sinon-chai');
const sinon = require('sinon');
const EnvelopeHandler = require('./envelopeHandler');
const Db = require('./utils/db');

chai.use(sinonChai);

const expectThrow = async (promise, message) => {
  try {
    await promise;
    expect.fail('Expected to throw');
  } catch (e) {
    expect(e.message).to.contain(message);
  }
};

const sdb = {
  getAttributes() {},
  putAttributes() {},
  select() {},
};

const ADDR = '0xf3beac30c498d9e26865f34fcaa57dbb935b0d74';
const ADDR2 = '0xaabeac30c498d9e26865f34fcaa57dbb935b0daa';
const MNEMONIC = 'unable drop gospel simple danger elbow brand head shrug cereal lens grain';
const URL = 'http://localhost';
const UNSPENTS = {json() {return {"jsonrpc":"2.0","id":1,"result":[{"outpoint":"0xea8397ef431ee361b8cf724d734266e2b7af1ebca4e81ad6d69fac906a2615d000","output":{"address":"0x83b3525e17f9eaa92dae3f9924cc333c94c7e98a","value":"500000000000000000","color":0}},{"outpoint":"0x93f35458993de3ae8021275e639d900d7a927014e9df2cf646f7f96f466f725901","output":{"address":"0x83b3525e17f9eaa92dae3f9924cc333c94c7e98a","value":"1000000000000000000","color":0}}]}
}};
const UNSPENTS_EMPTY = {json() {return {"jsonrpc":"2.0","id":1,"result":[]}
}};


describe('EnvelopeHandler', () => {

let queue = {
  put: (address) => { queue[address] = true; },
}; 

  describe('Create envelope', async() => {
    beforeEach(() => {
      queue = {
        put: (obj) => { queue[obj.claimantAddr] = obj; },
      };
    });

    it('should fail on invalid mnemonic', async () => {
      sinon.stub(sdb, 'select').yields(null, { Items: [{ Attributes: [{ Value: 1 }] }] });
      const invalid = 'bla bla bla';
      const handler = new EnvelopeHandler(null, new Db(sdb), invalid, URL);
      await expectThrow(
        handler.handleCreate(1, ADDR, ADDR),
        'Bad Request: Mnemonic invalid or undefined'
      );
    });


    it('should allow to create envelope', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      sinon.stub(sdb, 'select').yields(null, { Items: [{ Attributes: [{ Value: envelopeIndex.toString(10) }] }] });
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });

      const handler = new EnvelopeHandler(null, new Db(sdb), MNEMONIC, URL);
      const rsp = await handler.handleCreate(5, 0, ADDR);

      expect(sdb.putAttributes).calledWith(sinon.match({
        Attributes: [sinon.match.any
        , {
          Name: "envelopeIndex", Replace: true, Value: envelopeIndex.toString(10)
        }, {
          Name: "color", Replace: true, Value: '0'
        }, {
          Name: "maxAmount", Replace: true, Value: '0'
        }, {
          Name: "claimants", Replace: true, Value: `["${ADDR}"]`
        }, {
          Name: "numRecepients", Replace: true, Value: '5'
        }],
        ItemName: envelopeAddr,
      }));
      expect(rsp.address).to.equal(envelopeAddr);
    });

    it('should fail if creator address is not valid', async () => {
      const envelopeIndex = 3;
      sinon.stub(sdb, 'select').yields(null, { Items: [{ Attributes: [{ Value: envelopeIndex.toString(10) }] }] });
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });

      const handler = new EnvelopeHandler(null, new Db(sdb), MNEMONIC, URL);

      await expectThrow(
        handler.handleCreate(5, 0, '0x123'),
        'Not a valid Ethereum address'
      );
    });

    it('should fail if number of recepients is > 16', async () => {
      const envelopeIndex = 3;
      sinon.stub(sdb, 'select').yields(null, { Items: [{ Attributes: [{ Value: envelopeIndex.toString(10) }] }] });
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });

      const handler = new EnvelopeHandler(null, new Db(sdb), MNEMONIC, URL);

      await expectThrow(
        handler.handleCreate(17, 0, ADDR),
        'Number of recipients cannot be > 16'
      );
    });

    it('should fail if number of recepients is < 1', async () => {
      const envelopeIndex = 3;
      sinon.stub(sdb, 'select').yields(null, { Items: [{ Attributes: [{ Value: envelopeIndex.toString(10) }] }] });
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });

      const handler = new EnvelopeHandler(null, new Db(sdb), MNEMONIC, URL);

      await expectThrow(
        handler.handleCreate(-1, 0, ADDR),
        'Number of recipients cannot be < 1'
      );
    });

    afterEach(() => {
      if (sdb.getAttributes.restore) sdb.getAttributes.restore();
      if (sdb.putAttributes.restore) sdb.putAttributes.restore();
      if (sdb.select.restore) sdb.select.restore();
    });
  });

  describe('Claim share', async() => {
    beforeEach(() => {
      queue = {
        put: (obj) => { queue[obj] = true; },
      };
    });

    it('should allow to claim from envelope', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = ADDR;
      const total = '1000000000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: total },
        { Name: 'claimants', Value: JSON.stringify([ADDR2]) },
        { Name: 'numRecepients', Value: '10' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));
      
      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await handler.handleClaim(envelopeAddr, claimantAddr);

      expect(sdb.putAttributes).calledWith(sinon.match({
        Attributes: [{
          Name: "claimants", Replace: true, Value: JSON.stringify([ADDR2, claimantAddr])
        }, {
          Name: "maxAmount", Replace: true, Value: total
        }],
        ItemName: envelopeAddr,
      }));
      const expectVal = {
        claimantAddr,
        addressIndex: envelopeIndex,
        color: 0,
        amount: '10000000000000000000',
      };
      expect(queue[JSON.stringify(expectVal)]).to.be.true;
    });

    it('should update maxAmount when envelope balance is higher', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = ADDR;
      const total = '1500000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: '1' },
        { Name: 'claimants', Value: JSON.stringify([ADDR2]) },
        { Name: 'numRecepients', Value: '10' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));
      
      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await handler.handleClaim(envelopeAddr, claimantAddr);

      expect(sdb.putAttributes).calledWith(sinon.match({
        Attributes: [{
          Name: "claimants", Replace: true, Value: JSON.stringify([ADDR2, claimantAddr])
        }, {
          Name: "maxAmount", Replace: true, Value: total
        }],
        ItemName: envelopeAddr,
      }));
    });

    it('should fail if already claimed', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = ADDR;
      const total = '1000000000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: total },
        { Name: 'claimants', Value: JSON.stringify([ADDR2, ADDR]) },
        { Name: 'numRecepients', Value: '10' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));

      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await expectThrow(
        handler.handleClaim(envelopeAddr, claimantAddr),
        'already claimed'
      );
    });

    it('should fail if envelope is empty', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = ADDR;
      const total = '1000000000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: total },
        { Name: 'claimants', Value: JSON.stringify([ADDR2]) },
        { Name: 'numRecepients', Value: '10' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS_EMPTY));

      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await expectThrow(
        handler.handleClaim(envelopeAddr, claimantAddr),
        'Envelope depleted'
      );
    });

    it('should fail if recipient address is not valid', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = '0xaabeac30c498d9e26865f34fcaa57dbb935b0da';
      const total = '1000000000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: total },
        { Name: 'claimants', Value: JSON.stringify([ADDR2]) },
        { Name: 'numRecepients', Value: '10' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));

      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await expectThrow(
        handler.handleClaim(envelopeAddr, claimantAddr),
        'Not a valid Ethereum address'
      );
    });

    it('should send rest if number of claimants reach', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const envelopeIndex = 3;
      const claimantAddr = ADDR;
      const total = '1000000000000000000000';
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {
        Attributes: [
        { Name: 'envelopeIndex', Value: envelopeIndex },
        { Name: 'color', Value: '0' },
        { Name: 'maxAmount', Value: total },
        { Name: 'claimants', Value: JSON.stringify([ADDR2, ADDR2, ADDR2]) },
        { Name: 'numRecepients', Value: '3' },
      ] });

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));

      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      const rsp = await handler.handleClaim(envelopeAddr, claimantAddr);
      expect(rsp.amount !== '0');
    });

    it('should fail if envelope doesn\'t exist', async () => {
      const envelopeAddr = '0x27f748becc70b70e81177266a55c1c93738a2b07';
      const claimantAddr = ADDR;
      sinon.stub(sdb, 'putAttributes').yields(null, { ResponseMetadata: {} });
      sinon.stub(sdb, 'getAttributes').yields(null, {}).yields(null, {});

      sinon.stub(fetch, 'Promise').returns(Promise.resolve(UNSPENTS));

      const handler = new EnvelopeHandler(queue, new Db(sdb),null,URL, fetch);
      await expectThrow(
        handler.handleClaim(envelopeAddr, claimantAddr),
        'Envelope doesn\'t exist on address: ' + envelopeAddr
      );
    });

    afterEach(() => {
      if (sdb.getAttributes.restore) sdb.getAttributes.restore();
      if (sdb.putAttributes.restore) sdb.putAttributes.restore();
      if (sdb.select.restore) sdb.select.restore();
      if (fetch.Promise.restore) fetch.Promise.restore();
    });
  });
});
