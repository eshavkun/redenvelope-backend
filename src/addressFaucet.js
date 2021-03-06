const AWS = require('aws-sdk');
const { isValidAddress } = require('ethereumjs-util');
const Db = require('./utils/db');
const Queue = require('./utils/queue');
const { BadRequest } = require('./utils/errors');

exports.handler = async (event, context) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const address = body.address;

  const awsAccountId = context.invokedFunctionArn.split(':')[4];
  const queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${awsAccountId}/${process.env.QUEUE_NAME}`;

  const queue = new Queue(new AWS.SQS(), queueUrl);
  const db = new Db(process.env.TABLE_NAME);
  
  if (!isValidAddress(address)) {
    throw new BadRequest(`Not a valid Ethereum address: ${address}`);
  }

  const { created } = await db.getAddr(address);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  if (dayAgo < created) {
    throw new BadRequest(`not enough time passed since the last claim`);
  }

  await queue.put(address);
  await db.setAddr(address);

  return { 
    statusCode: 200,
    body: address
  };
};
