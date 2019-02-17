module.exports = class Queue {

  constructor(sqs, queueUrl) {
    this.sqs = sqs;
    this.queueUrl = queueUrl;
  }

  put(address) {
    return new Promise((resolve, reject) => {
      this.sqs.sendMessage({
        MessageBody: address,
        QueueUrl: this.queueUrl,
      }, (err, data) => {
        if (err) {
          reject(`sqs error: ${err}`);
        } else {
          resolve(data);
        }
      });
    });
  }

}
