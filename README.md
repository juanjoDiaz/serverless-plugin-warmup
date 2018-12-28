Serverless WarmUP Plugin ♨
=============================
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm version](https://badge.fury.io/js/serverless-plugin-warmup.svg)](https://badge.fury.io/js/serverless-plugin-warmup)
[![npm downloads](https://img.shields.io/npm/dm/serverless-plugin-warmup.svg)](https://www.npmjs.com/package/serverless-plugin-warmup)
[![license](https://img.shields.io/npm/l/serverless-plugin-warmup.svg)](https://raw.githubusercontent.com/FidelLimited/serverless-plugin-warmup/master/LICENSE)

Keep your lambdas warm during Winter.

**Requirements:**
* Serverless *v1.12.x* or higher (Recommended *v1.33.x* or higher because of [this](https://github.com/FidelLimited/serverless-plugin-warmup/pull/69)).
* AWS provider

## How it works

WarmUP solves *cold starts* by creating one schedule event lambda that invokes all the service lambdas you select in a configured time interval (default: 5 minutes) or a specific time, forcing your containers to stay alive.

## Setup


### Installation

Install via npm in the root of your Serverless service:

```sh
npm install serverless-plugin-warmup --save-dev
```

Add the plugin to the `plugins` array in your Serverless `serverless.yml`:

```yml
plugins:
  - serverless-plugin-warmup
```

### Global configuration

Add a `warmup.enabled` property to custom to enable/disable the warm up process by default for all the functions

Enable WarmUp in general:

```yml
custom:
  warmup:
    enabled: true
```

For a specific stage:

```yml
custom:
  warmup:
    enabled: production
```

For several stages:

```yml
custom:
  warmup:
    enabled: 
      - production
      - staging
```

#### Function-specific configuration

You can override the global `enabled` configuration on any function.

Enable WarmUp for a specific function

```yml
functions:
  hello:
    warmup:
      enabled: true
```

For a specific stage:

```yml
functions:
  hello:
    warmup:
      enabled: production
```

For several stages:

```yml
functions:
  hello:
    warmup:
      enabled:
        - production
        - staging
```

Do not warm-up a function if `enabled` is set to false:
 ```yml
custom:
  warmup:
    enabled: true

...

functions:
  hello:
    warmup:
      enabled: false
```

### Other Options

#### Global options

* **folderName** (default `_warmup`)
* **cleanFolder** (default `true`)
* **name** (default `${service}-${stage}-warmup-plugin`)
* **role** (default to role in the provider)
* **tags** (default to serverless default tags)
* **schedule** (default `rate(5 minutes)`) - More examples [here](https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html).
* **memorySize** (default `128`)
* **timeout** (default `10` seconds)
* **prewarm** (default `false`)

#### Options that can be overridden per function

* **enabled** (default `false`)
* **source** (default `{ "source": "serverless-plugin-warmup" }`)
* **sourceRaw** (default `false`)
* **concurrency** (default `1`)

```yml
custom:
  warmup:
    enabled: true // Whether to warm up functions by default or not
    folderName: '_warmup' // Name of the folder created for the generated warmup 
    cleanFolder: false
    memorySize: 256
    name: 'make-them-pop'
    role: myCustRole0
    tags:
      Project: foo
      Owner: bar 
    schedule: 'cron(0/5 8-17 ? * MON-FRI *)' // Run WarmUP every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)
    timeout: 20
    prewarm: true // Run WarmUp immediately after a deploymentlambda
    source: '{ "source": "my-custom-payload" }'
    sourceRaw: true // Won't JSON.stringify() the source, may be necessary for Go/AppSync deployments
    concurrency: 5 // Warm up 5 concurrent instances
```

**Options should be tweaked depending on:**
* Number of lambdas to warm up
* Day cold periods
* Desire to avoid cold lambdas after a deployment

**Lambdas invoked by WarmUP will have event source `serverless-plugin-warmup` (unless otherwise specified above):**

```json
{
  "Event": {
    "source": "serverless-plugin-warmup"
  }
}
```

### Permissions

WarmUP requires some permissions to be able to `invoke` lambdas.

```yaml
custom:
  warmup:
    folderName: '_warmup' # Name of the folder created for the generated warmup 
    cleanFolder: false
    memorySize: 256
    name: 'make-them-pop'
    role:  myCustRole0
    schedule: 'cron(0/5 8-17 ? * MON-FRI *)' # Run WarmUP every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)
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
          Version: '2017'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        Policies:
          - PolicyName: myPolicyName
            PolicyDocument:
              Version: '2017'
              Statement:
                - Effect: Allow # WarmUp lamda to send logs to CloudWatch
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
                - Effect: Allow # WarmUp lamda to manage ENIS (only needed if deploying to VPC, https://docs.aws.amazon.com/lambda/latest/dg/vpc.html)
                  Action:
                    - ec2:CreateNetworkInterface
                    - ec2:DescribeNetworkInterfaces
                    - ec2:DetachNetworkInterface
                    - ec2:DeleteNetworkInterface
                  Resource: "*"
                - Effect: 'Allow' # WarmUp lamda to invoke the functions to be warmed
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
  runtime: nodejs6.10
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
If using pre-warm, the deployment user also needs a similar policy so it can run the WarmUp lambda.


#### On the function side

Add an early callback call when the event source is `serverless-plugin-warmup`. You should do this early exit before running your code logic, it will save your execution duration and cost:

```javascript
module.exports.lambdaToWarm = function(event, context, callback) {
  /** Immediate response for WarmUP plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUP - Lambda is warm!')
    return callback(null, 'Lambda is warm!')
  }

  ... add lambda logic after
}
```
You can also check for the warmp event using the `context` variable. This could be useful if you are handling the raw input and output streams:

```javascript
...

if(context.custom.source === 'serverless-plugin-warmup'){
  console.log('WarmUP - Lambda is warm!')
  return callback(null, 'Lambda is warm!')
}

...
```
If you're using the `concurrency` option you might consider adding a slight delay before returning when warming up to ensure your function doesn't return before all concurrent requests have been started:

```javascript
module.exports.lambdaToWarm = function(event, context, callback) {
  if (event.source === 'serverless-plugin-warmup') {
    /** Slightly delayed (25ms) response for WarmUP plugin to ensure concurrent invocation */
    await new Promise(r => setTimeout(r, 25))
    console.log('WarmUP - Lambda is warm!')
    return
  }

  ... add lambda logic after
}
```
## Deployment

Once everything is configured WarmUP will run on SLS `deploy`.

```sh
serverless deploy
```

## Packaging
WarmUp also runs on SLS `package`.

If you are doing your own [package artifact](https://serverless.com/framework/docs/providers/aws/guide/packaging#artifact) set the `cleanFolder` option to `false` and run
```sh
serverless package
```

This will allow you to extract the `warmup` NodeJS lambda file from the `_warmup` folder and add it in your custom artifact logic.

## Gotchas

If you are deploying to a VPC, you need to use private subnets with a Network Address Translation (NAT) gateway (http://docs.aws.amazon.com/lambda/latest/dg/vpc.html). WarmUp requires this so it can call the other lambdas but this is applicable to any lambda that needs access to the public internet or to any other AWS service.

## Cost

Lambda pricing [here](https://aws.amazon.com/lambda/pricing/). CloudWatch pricing [here](https://aws.amazon.com/cloudwatch/pricing/). You can use [AWS Lambda Pricing Calculator](https://s3.amazonaws.com/lambda-tools/pricing-calculator.html) to check how much will cost you monthly.

#### Example

Free Tier not included + Default WarmUP options + 10 lambdas to warm, each with `memorySize = 1024` and `duration = 10`:
* WarmUP: runs 8640 times per month = $0.18
* 10 warm lambdas: each invoked 8640 times per month = $14.4
* Total = $14.58

CloudWatch costs are not in this example because they are very low.

## Contribute

Help us making this plugin better and future proof.

* Clone the code
* Install the dependencies with `npm install`
* Create a feature branch `git checkout -b new_feature`
* Lint with standard `npm run lint`

## License

This software is released under the MIT license. See [the license file](LICENSE) for more details.
