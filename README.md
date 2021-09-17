# Serverless WarmUp Plugin ♨
[![Serverless][serverless-badge]](serverless-badge-url)
[![npm version][npm-version-badge]][npm-version-badge-url]
[![npm monthly downloads][npm-downloads-badge]][npm-version-badge-url]
[![Build Status][travis-badge]][travis-badge-url]
[![Coverage Status][coveralls-badge]][coveralls-badge-url]
[![license](https://img.shields.io/npm/l/serverless-plugin-warmup.svg)](https://raw.githubusercontent.com/juanjoDiaz/serverless-plugin-warmup/master/LICENSE)

Keep your lambdas warm during winter.

**Requirements:**
* Serverless *v1.12.x* or higher (Recommended *v1.33.x* or higher because of [this](https://github.com/juanjoDiaz/serverless-plugin-warmup/pull/69)).
* AWS provider

## How it works

WarmUp solves *cold starts* by creating a scheduled lambda (the warmer) that invokes all the selected service's lambdas in a configured time interval (default: 5 minutes) and forcing your containers to stay warm.

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

The warmup plugin supports creating one or more warmer functions. Warmers must be defined under `custom.warmup` in the `serverless.yaml` file before they can be used in the functions' configs:

```yaml
custom:
  warmup:
    officeHoursWarmer:
      enabled: true
      events:
        - schedule: cron(0/5 8-17 ? * MON-FRI *)
      concurrency: 10
    outOfOfficeHoursWarmer:
      enabled: true
      events:
        - schedule: cron(0/5 0-7 ? * MON-FRI *)
        - schedule: cron(0/5 18-23 ? * MON-FRI *)
        - schedule: cron(0/5 * ? * SAT-SUN *)
      concurrency: 1
    testWarmer:
      enabled: false
```

The options are the same for all the warmers:

* **folderName** Folder to temporarily store the generated code (defaults to `.warmup`)
* **cleanFolder** Whether to automatically delete the generated code folder. You might want to keep it if you are doing some custom packaging (defaults to `true`)
* **name** Name of the generated warmer lambda (defaults to `${service}-${stage}-warmup-plugin-${warmerName}`)
* **role** Role to apply to the warmer lambda (defaults to the role in the provider)
* **tags** Tag to apply to the generated warmer lambda (defaults to the serverless default tags)
* **vpc** The VPC and subnets in which to deploy. Can be any [Serverless VPC configuration](https://serverless.com/framework/docs/providers/aws/guide/functions#vpc-configuration) or be set to `false` in order to deploy the warmup function outside of a VPC (defaults to the vpc in the provider)
* **memorySize** The memory to be assigned to the warmer lambda (defaults to `128`)
* **events** The event that triggers the warmer lambda. Can be any [Serverless event](https://serverless.com/framework/docs/providers/aws/events/) (defaults to `- schedule: rate(5 minutes)`)
* **package** The package configuration. Can be any [Serverless package configuration](https://serverless.com/framework/docs/providers/aws/guide/packaging#package-configuration) (defaults to `{ individually: true, patterns: ['!**', '.warmup/${warmerName}/**'] }`)
* **timeout** How many seconds until the warmer lambda times out. (defaults to `10`)
* **environment** Can be used to set environment variables in the warmer lambda. You can also unset variables configured at the provider by setting them to undefined. However, you should almost never have to change the default. (defaults to unset all package level environment variables. )
* **tracing** Specify whether to enable/disable tracing at the function level. When tracing is enabled, warmer functions will use NPM to install the X-Ray client and use it to trace requests (It takes any of the values supported by serverless as `boolean`, `Active`or `PassThrough` and defaults to the provider-level setting)
* **prewarm** If set to true, it warms up your lambdas right after deploying (defaults to `false`)

There are also some options which can be set under `custom.warmup.<yourWarmer>` to be applied to all your lambdas or under `yourLambda.warmup.<yourWarmer>` to  overridde the global configuration for that particular lambda. Keep in mind that in order to configure a warmer at the function level, it needed to be previously configured at the `custom` section or the pluging will error.

* **enabled** Whether your lambda should be warmed up or not. Can be a boolean, a stage for which the lambda will be warmed up or a list of stages for which your lambda will be warmed up (defaults to `false`)
* **alias** Alias qualifier to use when invoking the functions. Necessary, for example, when this plugin is combined with the [serverless-plugin-canary-deployments](https://github.com/davidgf/serverless-plugin-canary-deployments) serverless canary plugin (warmup should always be declared after).
* **clientContext** Custom data to send as client context to the data. It should be an object where all the values are strings. (defaults to the payload. Set it to `false` to avoid sending any client context custom data)
* **payload** The payload to send to your lambda. This helps your lambda identify when the call comes from this plugin (defaults to `{ "source": "serverless-plugin-warmup" }`)
* **payloadRaw** Whether to leave the payload as-is. If false, the payload will be stringified into JSON. (defaults to `false`)
* **concurrency** The number of times that each of your lambda functions will be called in parallel. This can be used in a best-effort attempt to force AWS to spin up more parallel containers for your lambda. (defaults to `1`)

```yaml
custom:
  warmup:
    default:
      enabled: true # Whether to warm up functions by default or not
      folderName: '.warmup' # Name of the folder created for the generated warmup 
      cleanFolder: false
      memorySize: 256
      name: warmer-default
      role: WarmupRole
      tags:
        Project: foo
        Owner: bar 
      vpc: false
      events:
        - schedule: 'cron(0/5 8-17 ? * MON-FRI *)' # Run WarmUp every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)
      package:
        individually: true
        patterns:
          - '!../**'
          - '!../../**'
          - ./**
      timeout: 20
      tracing: true
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
      default:
        enabled: false

  myLowConcurrencyFunction:
    handler: 'myLowConcurrencyFunction.handler'
    events:
      - http:
          path: my-low-concurrency-function
          method: post
    warmup:
      default:
        clientContext:
          source: different-source-only-for-this-lambda
        payload:
          source: different-source-only-for-this-lambda
        concurrency: 1
   
  myProductionOnlyFunction:
    handler: 'myProductionOnlyFunction.handler'
    events:
      - http:
          path: my-production-only-function
          method: post
    warmup:
      default:
        enabled: prod
      
   myDevAndStagingOnlyFunction:
    handler: 'myDevAndStagingOnlyFunction.handler'
    events:
      - http:
          path: my-dev-and-staging-only-function
          method: post
    warmup:
      default:
        enabled:
          - dev
          - staging
```

### Runtime Configuration

Concurrency can be modified post-deployment at runtime by setting the warmer lambda environment variables.  
Two configuration options exist:
* Globally set the concurrency for all lambdas on the stack (overriding the deployment-time configuration):  
  Set the environment variable `WARMUP_CONCURRENCY`
* Individually set the concurrency per lambda  
  Set the environment variable `WARMUP_CONCURRENCY_YOUR_FUNCTION_NAME`. Must be all uppercase and hyphens (-) must be replaced with underscores (_). If present for one of your lambdas, it overrides the global concurrency setting.

### Networking

The WarmUp function use normal calls to the AWS SDK in order to keep your lambdas warm.
If you set up at the provider level or the warmer confir level that the wamer function should be deployed into into a VPC subnet you need to keep in mind a couple of things:

* If the subnet is public, access to the AWS API should be allowed by [Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html).
* If the subnet is private, a [Network Address Translation (NAT) gateway](http://docs.aws.amazon.com/lambda/latest/dg/vpc.html) is needed so the warmers can connect to the AWS API.
* In either case, the security group and the network ACLs need to allow access from the warmer to the AWS API.

Since the AWS SDK doesn't provide any timeout by default, this plugin uses a default connection timeout of 1 second. This is to avoid the issue of a lambda constantly timing out and consuming all its allowed duration simply because it can't connect to the AWS API.

### Permissions

WarmUp requires permission to be able to `invoke` your lambdas.

If no role is provided at the `custom.warmup` level, each warmer function gets a default role with minimal permissions allowing the warmer function to:
* Create its log stream and write logs to it
* Invoke the functions that it should warm (and only those)
* Create and attach elastic network interfaces (ENIs) which is necessary if deploying to a VPC

The default role for each warmer looks like:

```yaml
resources:
  Resources:
    WarmupRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: WarmupRole
        AssumeRolePolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Principal:
                Service:
                  - lambda.amazonaws.com
              Action: sts:AssumeRole
        Policies:
          - PolicyName: WarmUpLambdaPolicy
            PolicyDocument:
              Version: '2012-10-17'
              Statement:
               # Warmer lambda to send logs to CloudWatch
                - Effect: Allow
                  Action:
                    - logs:CreateLogGroup
                    - logs:CreateLogStream
                  Resource: 
                    - !Sub arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${warmer.name}:*
                - Effect: Allow
                  Action:
                    - logs:PutLogEvents
                  Resource: 
                    - !Sub arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${warmer.name}:*:*
                # Warmer lambda to invoke the functions to be warmed
                - Effect: 'Allow'
                  Action:
                    - lambda:InvokeFunction
                  Resource:
                    - !Sub arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${fn1.name}
                    - !Sub arn:${AWS::Partition}:lambda:${AWS::Region}:${AWS::AccountId}:function:${fn2.name}
                    # and one more row for each function that must be warmed up by the warmer
                # Warmer lambda to manage ENIS (only needed if deploying to VPC, https://docs.aws.amazon.com/lambda/latest/dg/vpc.html)
                - Effect: Allow
                  Action:
                    - ec2:CreateNetworkInterface
                    - ec2:DescribeNetworkInterfaces
                    - ec2:DetachNetworkInterface
                    - ec2:DeleteNetworkInterface
                  Resource: "*"
```

The permissions can also be added to all lambdas using setting the role to `IamRoleLambdaExecution` and setting the permissions in `iamRoleStatements` under `provider` (see https://serverless.com/framework/docs/providers/aws/guide/functions/#permissions):

```yaml
provider:
  name: aws
  runtime: nodejs14.x
  iamRoleStatements:
    - Effect: 'Allow'
      Action:
        - 'lambda:InvokeFunction'
      Resource:
      - !Sub arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${self:service}-${opt:stage, self:provider.stage}-*
custom:
  warmup:
    default:
      enabled: true
      role: IamRoleLambdaExecution
```

If setting `prewarm` to `true`, the deployment user used by the AWS CLI and the Serverless framework also needs permissions to invoke the warmer.

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

Using the Promise style:

```js
module.exports.lambdaToWarm = async function(event, context) {
  /** Immediate response for WarmUp plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    return 'Lambda is warm!';
  }

  // ... function logic
}
```

Using the Callback style:

```js
module.exports.lambdaToWarm = function(event, context, callback) {
  /** Immediate response for WarmUp plugin */
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!')
    return callback(null, 'Lambda is warm!')
  }

  // ... function logic
}
```

Using the context. This could be useful if you are handling the raw input and output streams.

```js
module.exports.lambdaToWarm = async function(event, context) {
  /** Immediate response for WarmUp plugin */
  if (context.custom.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    return 'Lambda is warm!';
  }

  // ... function logic
}
```

If you're using the `concurrency` option you might want to add a slight delay before returning on warmup calls to ensure that your function doesn't return before all concurrent requests have been started:

```js
module.exports.lambdaToWarm = async (event, context) => {
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda is warm!');
    /** Slightly delayed (25ms) response 
    	to ensure concurrent invocation */
    await new Promise(r => setTimeout(r, 25));
    return 'Lambda is warm!';
  }

  // ... add lambda logic after
}
```

### Python

You can handle it in your function:

```python
def lambda_handler(event, context):
    # early return call when the function is called by warmup plugin
    if event.get("source") == "serverless-plugin-warmup":
        print("WarmUp - Lambda is warm!")
        return {}

    # ... function logic
```

Or you could use a decorator to avoid the redundant logic in all your functions:

```python
def skip_execution_if.warmup_call(func):
    def warmup_wrapper(event, context):
      if event.get("source") == "serverless-plugin-warmup":
        print("WarmUp - Lambda is warm!")
        return {}

      return func(event, context)

    return warmup_wrapper

# ...

@skip_execution_if.warmup_call
def lambda_handler(event, context):
    # ... function logic
```

### Java

You can handle it in your function:

```java
public ApiGatewayResponse handleRequest(Map<String, Object> input, Context context) {
  if ("serverless-plugin-warmup".equals(input.get("source"))) {
    System.out.println("WarmUp - Lambda is warm!");
    return ApiGatewayResponse.builder()
        .setStatusCode(200)
        .build();
  }
  
  // ... function logic
}
```

### Ruby

You can handle it in your function:

```ruby
def handle_request(app:, event:, context:, config: {})
  if event['source'] == 'serverless-plugin-warmup'
    puts 'WarmUp - Lambda is warm!'
    return {} 
  end

  # ... function logic
end
```

## Lifecycle hooks

WarmUp plugin uses 3 lifecycles hooks:

* `warmup:addWarmers:addWarmers`: This is where the warmers are added to the service. It runs `after:package:initialize`.
* `warmup:cleanupTempDir:cleanup`: This is where the warmers' temp folders are removed. It runs `after:package:createDeploymentArtifacts`.
* `warmup:prewarm:start`: This is where the warmers are invoked. It runs `after:deploy:deploy` or when running the command `serverless warmup prewarm`.
* `warmup:prewarm:end`: This is after the warmers are invoked. 

## Usage

### Packaging

WarmUp supports

```sh
serverless package
```

By default, each warmer function is packaged individually and it uses a folder named `.warmup/<function_name>` to serve as temporary folder during the packaging process. This folder is deleted at the end of the packaging process unless the `cleanFolder` option is set to `false`.

If you are doing your own [package artifact](https://serverless.com/framework/docs/providers/aws/guide/packaging#artifact) you can set the `cleanFolder` option to `false` and include the `.warmup` folder in your custom artifact.

### Deployment

WarmUp adds package the warmers and add them to your services automatically when you run

```sh
serverless deploy
```

After the deployment, any warmer with `prewarm: true` is automatically invoked to warm up your functions without delay.


## Prewarming

Apart from prewarming automatically after each deployment. You can invokes a warmer after a sucessful deployment to warm up functions using:

```sh
serverless warmup prewarm -warmers <warmer_name>
```

The `warmers` flag takes a comma-separated list of warmer names. If it's nor provided, all warmers with `prewarm` set to `true` are invoked.

## Migrations

### v5.X to v6.X

#### Removed include/exclude in favour of patterns

From Serverless 2.32.0 the `patterns` option is the recommended approach to include/exclude files from packaging. In version 3.X, the `include` and `exclude` are removed.

This plugin applies the same philosophy.

What used to be:
```yaml
custom:
  warmup:
    default:
      enabled: 'prod'
      package:
        individually: true
        exclude: '../**',
        include: 'myFolder'
```

is the same as
```yaml
custom:
  warmup:
    default:
      enabled: 'prod'
      package:
        individually: true
        patterns:
          - '!../**',
          - 'myFolder'
```

### v4.X to v5.X

#### Support multiple warmer

Previous versions of the plugin only support a single warmer which limited use cases like having different concurrentcies in different time periods. From v5, multiple warmers are supported. The `warmup` field in the `custom` section or the function section, takes an object where each key represent the name of the warmer and the value the configuration which is exactly as it used to be except for the changes listed below.

```yaml
custom:
  warmup:
    enabled: true
    events:
      - schedule: rate(5 minutes)
```

have to be named, for example, to `default`:

```yaml
custom:
  warmup:
    default:
      enabled: true
      events:
        - schedule: rate(5 minutes)
```

#### Change the default temporary folder to `.warmup`

Previous versions of the plugin named the temporary folder to create the warmer handler `_warmup`. It has been renamed to `.warmup` to better align with the serverless framework and other plugins' behaviours.

Remembe to add `.warmup` to your git ignore.

#### Default to Unqualified alias

Previous versions of the plugin used the `$LATEST` alias as default alias to warm up if no alias was provided. From v5, the unqualified alias is the default. You can still use the `$LATEST` alias by setting it using the `alias` option.

```yaml
custom:
  warmup:
    default:
      alias: $LATEST
```

#### Automatically exclude package level includes

Previous versions of the plugin exclude everything in the service folder and include the `.warmup` folder. This caused that any files that you include to the service level were also included in the plugin specially if you include ancestor folders (like `../**`)
From v5, all service level include are automatically excluded from the plugin. You still override this behaviour using the `package` option.

#### Removed shorthand

Previous versions of the plugin supported replacing the configuration by a boolean, a string representing a stage or an array of strings representing a list of stages. From v5, this is not supported anymore. The `enabled` option is equivalent.

```yaml
custom:
  warmup: 'prod'
```

is the same as
```yaml
custom:
  warmup:
    default: # Name of the warmer, see above
      enabled: 'prod'
```

#### Removed legacy options

The following legacy options have been completely removed:

* **default** Has been renamed to `enabled`
* **schedule** `schedule: rate(5 minutes)` is equivalent to `events: - schedule: rate(5 minutes)`.
* **source** Has been renamed to `payload`
* **sourceRaw** Has been renamed to `payloadRaw`

#### Automatically creates a role for the lambda

If no role is provided in the `custom.warmup` config, a default role with minimal permissions is created for each warmer. See "Permissions" section

#### Support Tracing

If tracing is enabled at the provider level or at the warmer config level, the X-Ray client is automatically installed and X-Ray tracing is enabled.

#### Add a 1 second connect timeout to the AWS SDK

See the "Networking" section for more details.

## Cost

You can check the Lambda [pricing](https://aws.amazon.com/lambda/pricing/) and CloudWatch [pricing](https://aws.amazon.com/cloudwatch/pricing/) or can use the [AWS Lambda Pricing Calculator](https://s3.amazonaws.com/lambda-tools/pricing-calculator.html) to estimate the monthly cost

#### Example

If you have a single warmer and want to warm 10 functions, each with `memorySize = 1024` and `duration = 10`, using the default settings (and we ignore the free tier):

* WarmUp: runs 8640 times per month = $0.18
* 10 warm lambdas: each invoked 8640 times per month = $14.4
* Total = $14.58

CloudWatch costs are not in this example because they are very low.

## Contribute

Help us making this plugin better and future-proof.

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
[travis-badge]: https://travis-ci.org/juanjoDiaz/serverless-plugin-warmup.svg
[travis-badge-url]: https://travis-ci.org/juanjoDiaz/serverless-plugin-warmup
[coveralls-badge]: https://coveralls.io/repos/juanjoDiaz/serverless-plugin-warmup/badge.svg?branch=master
[coveralls-badge-url]: https://coveralls.io/r/juanjoDiaz/serverless-plugin-warmup?branch=master

## Acknowledgements

Thanks to [Fidel](https://github.com/fidelLimited) who initially developed this plugin.
