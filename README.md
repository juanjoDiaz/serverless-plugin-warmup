Serverless WarmUP Plugin ♨
=============================
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com) 
[![npm version](https://badge.fury.io/js/serverless-plugin-warmup.svg)](https://badge.fury.io/js/serverless-plugin-warmup)
[![dependencies](https://img.shields.io/david/FidelLimited/serverless-plugin-warmup.svg)](https://www.npmjs.com/package/serverless-plugin-warmup)
[![license](https://img.shields.io/npm/l/serverless-plugin-warmup.svg)](https://raw.githubusercontent.com/FidelLimited/serverless-plugin-warmup/master/LICENSE)

Keep your lambdas warm during Winter.

**Requirements:**
* Serverless *v1.12.x* or higher.
* AWS provider and nodejs4.3 or nodejs6.10 runtimes

## How it works

WarmUP solves *cold starts* by creating one schedule event lambda that invokes all the service lambdas you select in a configured time interval (default: 5 minutes) or a specific time, forcing your containers to stay alive. 

## Setup

 Install via npm in the root of your Serverless service:
```
npm install serverless-plugin-warmup --save-dev
```

* Add the plugin to the `plugins` array in your Serverless `serverless.yml`:

```yml
plugins:
  - serverless-plugin-warmup
```

* Add `warmup: true` property to all functions you want to be warm:

```yml
functions:
  hello:
    warmup: true
```

* WarmUP to be able to `invoke` lambdas requires the following Policy Statement in `iamRoleStatements`:

```yaml
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

* Add an early callback call when the event source is `serverless-plugin-warmup`. You should do this early exit before running your code logic, it will save your execution duration and cost:

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

* All done!

## Options

* **memorySize** (default `128`)
* **name** (default `warmup-plugin-${service}-${stage}`)
* **schedule** (default `rate(5 minutes)`) - More examples [here](https://docs.aws.amazon.com/lambda/latest/dg/tutorial-scheduled-events-schedule-expressions.html).
* **timeout** (default `10` seconds)

```yml
custom:
  warmup:
    memorySize: 256
    name: 'make-them-pop'
    schedule: 'cron(0/5 8-17 ? * MON-FRI *) // Run WarmUP every 5 minutes Mon-Fri between 8:00am and 5:55pm (UTC)'
    timeout: 20
```

**Options should be tweaked depending on:**
* Number of lambdas to warm up
* Day cold periods

**Lambdas invoked by WarmUP will have event source `serverless-plugin-warmup`:**

```json
{
  "Event": {
    "source": "serverless-plugin-warmup"
  }
}
```

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
