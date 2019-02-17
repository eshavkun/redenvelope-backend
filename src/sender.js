const fetch = require('node-fetch');
const dispenseTokens = require('./dispenseTokens');

const AWS = require('aws-sdk');
const ssm = new AWS.SSM();

const readEncryptedProperty = name => new Promise((resolve, reject) => {
  ssm.getParameter({ Name: name, WithDecryption: true }, (err, data) => {
    if (err) return reject(err);
    return resolve(data.Parameter.Value);
  });
});

exports.handler = async (event) => {
  const providerUrl = process.env.PROVIDER_URL;
  const mnemonic = await readEncryptedProperty(`/redenvelope/${process.env.ENV}/MNEMONIC`);

  const requests = event.Records.map(r => JSON.parse(r.body));

  await dispenseTokens(requests, fetch, providerUrl, mnemonic);
};
