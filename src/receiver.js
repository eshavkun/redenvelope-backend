const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const Db = require('./utils/db');
const Queue = require('./utils/queue');
const EnvelopeHandler = require('./envelopeHandler');

const ssm = new AWS.SSM();
const simpledb = new AWS.SimpleDB();

const readEncryptedProperty = name => new Promise((resolve, reject) => {
  ssm.getParameter({ Name: name, WithDecryption: true }, (err, data) => {
    if (err) return reject(err);
    return resolve(data.Parameter.Value);
  });
});

exports.handler = async(event, context) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

  const awsAccountId = context.invokedFunctionArn.split(':')[4];
  const queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${awsAccountId}/${process.env.QUEUE_NAME}`;

  const queue = new Queue(new AWS.SQS(), queueUrl);
  const providerUrl = process.env.PROVIDER_URL;
  const mnemonic = await readEncryptedProperty(`/redenvelope/${process.env.ENV}/MNEMONIC`);

  const service = new EnvelopeHandler(
    queue,
    new Db(simpledb, process.env.TABLE_NAME),
    mnemonic,
    providerUrl,
    fetch,
  );

  const path = event.context['resource-path'];

  const getRequestHandler = () => {
    if (path.indexOf('fund') > -1) {
      return service.handleCreate(body.numRecipients, body.color, body.from);
    } else if (path.indexOf('claim') > -1) {
      return service.handleClaim(body.envelopeAddr, body.claimantAddr);
    }
    return Promise.reject(`Not Found: unexpected path: ${path}`);
  };

  return await getRequestHandler();
};
