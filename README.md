# Serverless WarmUp Plugin ♨
[![Serverless][serverless-badge]](serverless-badge-url)
[![npm version][npm-version-badge]][npm-version-badge-url]
[![npm monthly downloads][npm-downloads-badge]][npm-version-badge-url]
[![Build Status][travis-badge]][travis-badge-url]
[![Coverage Status][coveralls-badge]][coveralls-badge-url]
[![Dependency Status][dev-badge]][dev-badge-url]
[![license](https://img.shields.io/npm/l/serverless-plugin-warmup.svg)](https://raw.githubusercontent.com/FidelLimited/serverless-plugin-warmup/master/LICENSE)

Keep your lambdas warm during winter.

**Requirements:**
* Serverless *v1.12.x* or higher (Recommended *v1.33.x* or higher because of [this](https://github.com/FidelLimited/serverless-plugin-warmup/pull/69)).
* AWS provider

## How it works

WarmUp solves *cold starts* by creating a scheduled lambda that invokes all the selected service's lambdas in a configured time interval (default: 5 minutes) and forcing your containers to stay warm.

## Installation

Install via npm in the root of your Serverless service:

```sh
npm install --save-dev serverless-plugin-warmup
```

Add the plugin to the `plugins` array in your Serverless `serverless.yaml`:

```yaml
plugins:
  - serverless-plugin-warmup
```

## Configuration

Most options are set under `custom.warmup` in the `serverless.yaml` file.

* **folderName** Folder to temporarily store the generated code (defaults to `_warmup`)
* **cleanFolder** Whether to automatically delete the generated code folder. You might want to keep it if you are doing some custom packaging (defaults to `true`)
* **name** Name of the generated warmer lambda (defaults to `${service}-${stage}-warmup-plugin`)
* **role** Role to apply to the warmer lambda (defaults to the role in the provider)
* **tags** Tag to apply to the generated warmer lambda (defaults to the serverless default tags)
* **vpc** The VPC and subnets in which to deploy. Can be any [Serverless VPC configuration](https://serverless.com/framework/docs/providers/aws/guide/functions#vpc-configuration) or be set to `false` in order to deploy the warmup function outside of a VPC (defaults to the vpc in the provider)
* **memorySize** The memory to be assigned to the warmer lambda (defaults to `128`)
* **events** The event that triggers the warmer lambda. Can be any [Serverless event](https://serverless.com/framework/docs/providers/aws/events/) (defaults to `- schedule: rate(5 minutes)`)
* **package** The package configuration. Can be any [Serverless package configuration](https://serverless.com/framework/docs/providers/aws/guide/packaging#package-configuration) (defaults to `{ individually: true, exclude: ['**'], include: ['_warmup/**'] }`)
* **timeout** How many seconds until the warmer lambda times out. (defaults to `10`)
* **environment** Can be used to set environment variables in the warmer lambda. You can also unset variables configured at the provider by setting them to undefined. However, you should almost never have to change the default. (defaults to unset all package level environment variables. )
* **prewarm** If set to true, it warms up your lambdas right after deploying (defaults to `false`)

There are also some options which can be set under `custom.warmup` to be applied to all your lambdas or under `yourLambda.warmup` to  overridde the global configuration for that particular lambda.

* **enabled** Whether your lambda should be warmed up or not. Can be a boolean, a stage for which the lambda will be warmed up or a list of stages for which your lambda will be warmed up (defaults to `false`)
* **clientContext** Custom data to send as client context to the data. It should be an object where all the values are strings. (defaults to the payload. Set it to `false` to avoid sending any client context custom data)
* **payload** The payload to send to your lambda. This helps your lambda identify when the call comes from this plugin (defaults to `{ "source": "serverless-plugin-warmup" }`)
* **payloadRaw** Whether to leave the payload as-is. If false, the payload will be stringified into JSON. (defaults to `false`)
* **concurrency** The number of times that each of your lambda functions will be called in parallel. This can be used in a best-effort attempt to force AWS to spin up more parallel containers for your lambda. (defaults to `1`)

```yaml
custom:
  warmup:
    enabled: true # Whether to warm up functions by default or not
    folderName: '_warmup' # Name of the folder created for the generated warmup 
    cleanFolder: false
    memorySize: 256
    name: 'make-them-pop'
    role: myCustRole0
    tags:
      Project: foo
      Owner: bar 
    vpc: false
    events:
      - schedule: 'cron(0/5 8-17 ? * MON-FRI *)' # Run WarmUp every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)
    package:
      individually: true
      exclude: # exclude additional binaries that are included at the serverless package level
        - ../**
        - ../../**
      include:
        - ./**
    timeout: 20
    prewarm: true # Run WarmUp immediately after a deploymentlambda
    clientContext:
      source: my-custom-source
      other: '20'
    payload: 
      source: my-custom-source
      other: 20
    payloadRaw: true # Won't JSON.stringify() the payload, may be necessary for Go/AppSync deployments
    concurrency: 5 # Warm up 5 concurrent instances
    
functions:
  myColdfunction:
    handler: 'myColdfunction.handler'
    events:
      - http:
          path: my-cold-function
          method: post
    warmup:
      enabled: false

  myLowConcurrencyFunction:
    handler: 'myLowConcurrencyFunction.handler'
    events:
      - http:
          path: my-low-concurrency-function
          method: post
    warmup:
      payload: different-source-only-for-this-lambda
      concurrency: 1
   
  myProductionOnlyFunction:
    handler: 'myProductionOnlyFunction.handler'
    events:
      - http:
          path: my-production-only-function
          method: post
    warmup:
      enabled: prod
      
   myDevAndStagingOnlyFunction:
    handler: 'myDevAndStagingOnlyFunction.handler'
    events:
      - http:
          path: my-dev-and-staging-only-function
          method: post
    warmup:
      enabled:
        - dev
        - staging
```

##### Options should be tweaked depending on:

* Number of lambdas to warm up
* Day cold periods
* Desire to avoid cold lambdas after a deployment

#### Runtime Configuration
Concurrency can be modified post-deployment at runtime by setting the warmer lambda environment variables.  
Two configuration options exist:
* Globally set the concurrency for all lambdas on the stack (overriding the deployment-time configuration):  
  Set the environment variable `WARMUP_CONCURRENCY`
* Individually set the concurrency per lambda  
  Set the environment variable `WARMUP_CONCURRENCY_YOUR_FUNCTION_NAME`. Must be all uppercase and hyphens (-) must be replaced with underscores (_). If present for one of your lambdas, it overrides the global concurrency setting. 

#### Legacy options

Over time some options have been removed from the plugin.
For now, we keep backwards compatibility so they still work.
However, they are listed here only to facilitate upgrading the plugin and we strongly recommend switching to the options defined above as soon as possible.

* **default** Has been renamed to `enabled`
* **schedule** `schedule: rate(5 minutes)` is equivalent to `events: - schedule: rate(5 minutes)`.
* **source** Has been renamed to `payload`
* **sourceRaw** Has been renamed to `payloadRaw`

### Permissions

WarmUp requires some permissions to be able to `invoke` your lambdas.

```yaml
custom:
  warmup:
    folderName: '_warmup' # Name of the folder created for the generated warmup 
    cleanFolder: false
    memorySize: 256
    name: 'make-them-pop'
    role:  myCustRole0
    events:
      - schedule: 'cron(0/5 8-17 ? * MON-FRI *)' # Run WarmUp every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)
    timeout: 20
    prewarm: true # Run WarmUp immediately after a deployment
    tags:
      Project: foo
      Owner: bar

.....

resources:
  Resources:
    myCustRole0:
      Type: AWS::IAM::Role
      Properties:
        Path: /my/cust/path/
        RoleName: MyCustRole0
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        Policies:
          - PolicyName: myPolicyName
            PolicyDocument:
              Version: '2012-10-17'
              Statement:
                - Effect: Allow # Warmer lambda to send logs to CloudWatch
                  Action:
                    - logs:CreateLogGroup
                    - logs:CreateLogStream
                    - logs:PutLogEvents
                  Resource: 
                    - 'Fn::Join':
                      - ':'
                      -
                        - 'arn:aws:logs'
                        - Ref: 'AWS::Region'
                        - Ref: 'AWS::AccountId'
                        - 'log-group:/aws/lambda/*:*:*'
                - Effect: Allow # Warmer lambda to manage ENIS (only needed if deploying to VPC, https://docs.aws.amazon.com/lambda/latest/dg/vpc.html)
                  Action:
                    - ec2:CreateNetworkInterface
                    - ec2:DescribeNetworkInterfaces
                    - ec2:DetachNetworkInterface
                    - ec2:DeleteNetworkInterface
                  Resource: "*"
                - Effect: 'Allow' # Warmer lambda to invoke the functions to be warmed
                  Action:
                    - 'lambda:InvokeFunction'
                  Resource:
                  - Fn::Join:
                    - ':'
                    - - arn:aws:lambda
                      - Ref: AWS::Region
                      - Ref: AWS::AccountId
                      - function:${self:service}-${opt:stage, self:provider.stage}-*
```

The permissions can also be added to all lambdas using `iamRoleStatements` under `provider` (see https://serverless.com/framework/docs/providers/aws/guide/functions/#permissions):

```yaml
provider:
  name: aws
  runtime: nodejs10.x
  iamRoleStatements:
    - Effect: 'Allow'
      Action:
        - 'lambda:InvokeFunction'
      Resource:
      - Fn::Join:
        - ':'
        - - arn:aws:lambda
          - Ref: AWS::Region
          - Ref: AWS::AccountId
          - function:${self:service}-${opt:stage, self:provider.stage}-*
```
If using pre-warm, the deployment user also needs a similar policy so it can run the warmer lambda.


## On the function side

When invoked by WarmUp, your lambdas will have the event source `serverless-plugin-warmup` (unless otherwise specified using the `payload` option):

```json
{
  "Event": {
    "source": "serverless-plugin-warmup"
  }
}
```

To minimize cost and avoid running your lambda unnecessarily, you should add an early return call before your lambda logic when that payload is received.

### Javascript
```javascript
// Using the Promise style
module.exports.lambdaToWarm = async function(event, context) {
  /** Immediate response for WarmUp plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    return 'Lambda is warm!';
  }

  ... add lambda logic after
}

// Using the Callback style
module.exports.lambdaToWarm = function(event, context, callback) {
  /** Immediate response for WarmUp plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!')
    return callback(null, 'Lambda is warm!')
  }

  ... add lambda logic after
}

// Using context.
// This could be useful if you are handling the raw input and output streams.
module.exports.lambdaToWarm = async function(event, context) {
  /** Immediate response for WarmUp plugin */
  if (context.custom.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    return 'Lambda is warm!';
  }

  ... add lambda logic after
}
```

If you're using the `concurrency` option you might want to add a slight delay before returning on warmup calls to ensure that your function doesn't return before all concurrent requests have been started:

```javascript
module.exports.lambdaToWarm = async (event, context) => {
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    /** Slightly delayed (25ms) response 
    	to ensure concurrent invocation */
    await new Promise(r => setTimeout(r, 25));
    return 'Lambda is warm!';
    
  }

  ... add lambda logic after
}
```

### Python

```python
def lambda_handler(event, context):
    # early return call when the function is called by warmup plugin
    if event.get("source") in ["aws.events", "serverless-plugin-warmup"]:
        print('Lambda is warm!')
        return {}

    # function logic here
    ...
```

## Deployment

WarmUp supports `serverless deploy`.

## Packaging

WarmUp supports `serverless package`.

By default, the WarmUp function is packaged individually and it uses a folder named `_warmup` to store duiring the packaging process, which is deleted at the end of the process.

If you are doing your own [package artifact](https://serverless.com/framework/docs/providers/aws/guide/packaging#artifact) you can set the `cleanFolder` option to `false` and include the `_warmup` folder in your custom artifact.

## Gotchas

The WarmUp function use normal calls to the AWS SDK in order to keep your lambdas warm.
By deafult, the WarmUp function is deployed outside of any VPC so it can reach AWS API.
If you use the VPC option to deploy your WarmUp function to a VPC subnet it will need internet access. You can do it by using an [Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) or a [Network Address Translation (NAT) gateway](http://docs.aws.amazon.com/lambda/latest/dg/vpc.html). 

## Cost

You can check the Lambda [pricing](https://aws.amazon.com/lambda/pricing/) and CloudWatch [pricing](https://aws.amazon.com/cloudwatch/pricing/) or can use the [AWS Lambda Pricing Calculator](https://s3.amazonaws.com/lambda-tools/pricing-calculator.html) to estimate the monthly cost

#### Example

If you want to warm 10 functions, each with `memorySize = 1024` and `duration = 10`, using the default settings (and we ignore the free tier):

* WarmUp: runs 8640 times per month = $0.18
* 10 warm lambdas: each invoked 8640 times per month = $14.4
* Total = $14.58

CloudWatch costs are not in this example because they are very low.

## Contribute

Help us making this plugin better and future proof.

* Clone the code
* Install the dependencies with `npm install`
* Create a feature branch `git checkout -b new_feature`
* Add your code and add tests if you implement a new feature
* Validate your changes `npm run lint` and `npm test` (or `npm run test-with-coverage`)

## License

This software is released under the MIT license. See [the license file](LICENSE) for more details.

[serverless-badge]: http://public.serverless.com/badges/v3.svg
[serverless-badge-url]: http://www.serverless.com
[npm-version-badge]: https://badge.fury.io/js/serverless-plugin-warmup.svg
[npm-version-badge-url]: https://www.npmjs.com/package/serverless-plugin-warmup
[npm-downloads-badge]: https://img.shields.io/npm/dm/serverless-plugin-warmup.svg
[travis-badge]: https://travis-ci.org/FidelLimited/serverless-plugin-warmup.svg
[travis-badge-url]: https://travis-ci.org/FidelLimited/serverless-plugin-warmup
[coveralls-badge]: https://coveralls.io/repos/FidelLimited/serverless-plugin-warmup/badge.svg?branch=master
[coveralls-badge-url]: https://coveralls.io/r/FidelLimited/serverless-plugin-warmup?branch=master
[dev-badge]: https://david-dm.org/FidelLimited/serverless-plugin-warmup.svg
[dev-badge-url]: https://david-dm.org/FidelLimited/serverless-plugin-warmup
