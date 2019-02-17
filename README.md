# Redenvelope Manager

## Setup

Create required properties in [AWS parameter store](https://eu-west-1.console.aws.amazon.com/systems-manager/parameters/?region=eu-west-1):

> Tip: you can use `aws ssm put-parameter` CLI

### Private key holding tokens on Plasma:

1. Put your target env in the name (e.g. `/redenvelope/testnet/PRIV_KEY`)
2. Encrypt with KMS key

```
"Name": "/redenvelope/<env>/PRIV_KEY",
"Type": "SecureString",
```


## Deploy

1. Execute deployment:
```
KMS_KEY_ID=<kms-key-id> PROVIDER_URL=<plasma-node-json-rpc-url> sls deploy -s <env>
```

2. (First deployment only) Set up `dispenseTokens` lambda to run on new SQS message.
⚠️ It is a unsolved issue in serverless config — it should be set up with serverless, but isn't working for some reason.

### Testnet

```
yarn deploy:testnet
```

### Mainnet

```
yarn deploy:mainnet
```
