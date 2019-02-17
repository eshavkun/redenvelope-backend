const JSBI = require('jsbi');

// transform from key/value to list and back
const transform = (data) => {
  let attributes;
  if (Array.isArray(data)) {
    attributes = {};
    data.forEach((aPair) => {
      if (!attributes[aPair.Name]) {
        attributes[aPair.Name] = {};
      }
      attributes[aPair.Name] = aPair.Value;
    });
  } else {
    attributes = [];
    Object.keys(data).forEach((anAttributeName) => {
      if (Array.isArray(data[anAttributeName])) {
        data[anAttributeName].forEach((aValue) => {
          attributes.push({
            Name: anAttributeName,
            Value: aValue,
          });
        });
      } else {
        attributes.push({
          Name: anAttributeName,
          Value: data[anAttributeName],
        });
      }
    });
  }
  return attributes;
};

module.exports = class Db {

  constructor(simpledb, tableName) {
    this.sdb = simpledb;
    this.tableName = tableName;
  }

  getCount() {
    return new Promise((resolve, reject) => {
      this.sdb.select({
        SelectExpression: `select count(*) from \`${this.tableName}\``,
      }, (err, data) => {
        if (err) return reject(err);
        return resolve(data.Items ? data.Items[0].Attributes[0].Value : 0);
      });
    });
  }

  setEnvelope(envelopeAddr, envelopeIndex, color, maxAmount, claimants, numRecepients) {
    const val =  new Date().toString();
    if (!this.sdb) return;
    return this.putAttributes({
      DomainName: this.tableName,
      ItemName: envelopeAddr,
      Attributes: [
        { Name: 'created', Value: val, Replace: true },
        { Name: 'envelopeIndex', Value: envelopeIndex.toString(10), Replace: true },
        { Name: 'color', Value: color.toString(10), Replace: true },
        { Name: 'maxAmount', Value: maxAmount.toString(), Replace: true },
        { Name: 'claimants', Value: JSON.stringify(claimants), Replace: true },
        { Name: 'numRecepients', Value: numRecepients.toString(10), Replace: true },
      ],
    });
  }

  async getEnvelope(envelopeAddr) {
    const data = await this.getAttributes({
      DomainName: this.tableName,
      ItemName: envelopeAddr,
    });

    if(!data.Attributes) {
      throw new Error(`Bad Request: Envelope doesn't exist on address: ${envelopeAddr}`);
    }

    return Object.assign({ created: 0 }, transform(data.Attributes || []));
  }

  updateEnvelope(envelopeAddr, claimants, maxAmount = JSBI.BigInt(0)) {
    if (JSBI.greaterThan(maxAmount, JSBI.BigInt(0))) {
      return this.putAttributes({
        DomainName: this.tableName,
        ItemName: envelopeAddr,
        Attributes: [
          { Name: 'claimants', Value: JSON.stringify(claimants), Replace: true },
          { Name: 'maxAmount', Value: maxAmount.toString(), Replace: true }
        ],
      });
  } else {
    return this.putAttributes({
      DomainName: this.tableName,
      ItemName: envelopeAddr,
      Attributes: [
        { Name: 'claimants', Value: JSON.stringify(claimants), Replace: true },
      ],
    });
  }
  }

  method(name, params) {
    return new Promise((resolve, reject) => {
      this.sdb[name](params, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  putAttributes(params) {
    return this.method('putAttributes', params);
  }

  getAttributes(params) {
    return this.method('getAttributes', params);
  }

}
