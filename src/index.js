'use strict'

/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'bluebird'
 * @requires 'fs-extra'
 * @requires 'path'
 * */
const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs-extra'))
const path = require('path')

/**
 * @classdesc Keep your lambdas warm during Winter
 * @class WarmUP
 * */
class WarmUP {
  /**
   * @description Serverless Warm Up
   * @constructor
   *
   * @param {!Object} serverless - Serverless object
   * @param {!Object} options - Serverless options
   * */
  constructor (serverless, options) {
    /** Serverless variables */
    this.serverless = serverless
    this.options = options

    this.provider = this.serverless.getProvider('aws')

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this)
    }

    // See https://github.com/serverless/serverless/issues/2631
    this.options.stage = this.options.stage ||
      this.serverless.service.provider.stage ||
      (this.serverless.service.defaults && this.serverless.service.defaults.stage) ||
      'dev'
    this.options.region = this.options.region ||
      this.serverless.service.provider.region ||
      (this.serverless.service.defaults && this.serverless.service.defaults.region) ||
      'us-east-1'

    this.custom = this.serverless.service.custom

    this.configPlugin()
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {(boolean|Promise)}
   * */
  afterPackageInitialize () {
    return this.createWarmer()
  }

  /**
   * @description After create deployment artifacts. Clean prefix folder.
   *
   * @fulfil {} — Optimization finished
   * @reject {Error} Optimization error
   *
   * @return {Promise}
   * */
  afterCreateDeploymentArtifacts () {
    if (this.warmupOpts.cleanFolder) {
      return this.cleanFolder()
    }
  }

  /**
   * @description After deploy functions hooks
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  afterDeployFunctions () {
    if (this.warmupOpts.prewarm) {
      return this.warmUpFunctions()
    }
  }

  getGlobalConfig (config, defaultOpts = {}) {
    const folderName = (typeof config.folderName === 'string') ? config.folderName : '_warmup'
    const pathFolder = path.join(this.serverless.config.servicePath, folderName)

    return {
      folderName,
      pathFolder,
      pathFile: `${pathFolder}/index.js`,
      pathHandler: `${folderName}/index.warmUp`,
      cleanFolder: (typeof config.cleanFolder === 'boolean') ? config.cleanFolder : defaultOpts.cleanFolder,
      name: (typeof config.name === 'string') ? config.name : defaultOpts.name,
      role: (typeof config.role === 'string') ? config.role : defaultOpts.role,
      tags: (typeof config.tags === 'object') ? config.tags : defaultOpts.tags,
      schedule: (typeof config.schedule === 'string') ? [config.schedule]
        : (Array.isArray(config.schedule)) ? config.schedule : defaultOpts.schedule,
      memorySize: (typeof config.memorySize === 'number') ? config.memorySize : defaultOpts.memorySize,
      timeout: (typeof config.timeout === 'number') ? config.timeout : defaultOpts.timeout,
      prewarm: (typeof config.prewarm === 'boolean') ? config.prewarm : defaultOpts.prewarm
    }
  }

  getFunctionConfig (possibleConfig, defaultOpts) {
    const config = (typeof possibleConfig !== 'object')
      ? { enabled: possibleConfig }
      : possibleConfig

    // Keep backwards compatibility for now
    if (config.default) {
      config.enabled = possibleConfig.default
    }

    return {
      enabled: (typeof config.enabled === 'boolean' ||
          typeof config.enabled === 'string' ||
          Array.isArray(config.enabled))
        ? config.enabled
        : defaultOpts.enabled,
      source: (typeof config.source !== 'undefined')
        ? (config.sourceRaw ? config.source : JSON.stringify(config.source))
        : (defaultOpts.sourceRaw ? defaultOpts.source : JSON.stringify(defaultOpts.source)),
      concurrency: (typeof config.concurrency === 'number') ? config.concurrency : defaultOpts.concurrency
    }
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {}
   * */
  configPlugin () {
    const globalDefaultOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      memorySize: 128,
      name: this.serverless.service.service + '-' + this.options.stage + '-warmup-plugin',
      schedule: ['rate(5 minutes)'],
      timeout: 10,
      prewarm: false
    }

    const functionDefaultOpts = {
      enabled: false,
      source: JSON.stringify({ source: 'serverless-plugin-warmup' }),
      concurrency: 1
    }

    const customConfig = (this.custom && typeof this.custom.warmup !== 'undefined')
      ? this.custom.warmup
      : {}

    /** Set global custom options */
    this.warmupOpts = Object.assign(
      this.getGlobalConfig(customConfig, globalDefaultOpts),
      this.getFunctionConfig(customConfig, functionDefaultOpts)
    )
  }

  /**
   * @description Clean prefix folder
   *
   * @fulfil {} — Folder cleaned
   * @reject {Error} File system error
   *
   * @return {Promise}
   * */
  cleanFolder () {
    return fs.removeAsync(this.warmupOpts.pathFolder)
  }

  /**
   * @description Warm up functions
   *
   * @fulfil {} — Warm up function created and added to service
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  createWarmer () {
    /** Get functions */
    const functionsToWarmup = this.serverless.service.getAllFunctions()
      .map(name => this.serverless.service.getFunction(name))
      .map(config => ({ name: config.name, config: this.getFunctionConfig(config.warmup, this.warmupOpts) }))
      .filter(({ config: { enabled } }) => (
        enabled === true ||
        enabled === this.options.stage ||
        (Array.isArray(enabled) && enabled.indexOf(this.options.stage) !== -1)
      ))

    /** Skip writing if no functions need to be warm */
    if (!functionsToWarmup.length) {
      this.serverless.cli.log('WarmUP: no lambda to warm')
      return Promise.resolve()
    }

    /** Write warm up function */
    return this.createWarmUpFunctionArtifact(functionsToWarmup)
      .then(() => this.addWarmUpFunctionToService())
  }

  /**
   * @description Write warm up ES6 function
   *
   * @param {Array} functions - Functions to be warmed up
   *
   * @fulfil {} — Warm up function created
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  createWarmUpFunctionArtifact (functions) {
    /** Log warmup start */
    this.serverless.cli.log('WarmUP: setting ' + functions.length + ' lambdas to be warm')

    /** Log functions being warmed up */
    functions.forEach(func => this.serverless.cli.log('WarmUP: ' + func.name))

    const warmUpFunction = `"use strict";

/** Generated by Serverless WarmUP Plugin at ${new Date().toISOString()} */
const aws = require("aws-sdk");
aws.config.region = "${this.options.region}";
const lambda = new aws.Lambda();
const functions = ${JSON.stringify(functions)};

module.exports.warmUp = async (event, context, callback) => {
  console.log("Warm Up Start");
  
  const invokes = await Promise.all(functions.map(async (func) => {
    console.log(\`Warming up function: \${func.name} with concurrency: \${func.config.concurrency}\`);
    
    const params = {
      ClientContext: Buffer.from(\`{"custom":\${func.config.source}}\`).toString('base64'),
      FunctionName: func.name,
      InvocationType: "RequestResponse",
      LogType: "None",
      Qualifier: process.env.SERVERLESS_ALIAS || "$LATEST",
      Payload: func.config.source
    };
    
    try {
      await Promise.all(Array(func.config.concurrency).fill(0)
        .map(async _ => await lambda.invoke(params).promise()))
      console.log(\`Warm Up Invoke Success: \${func.name}\`);
      return true;
    } catch (e) {
      console.log(\`Warm Up Invoke Error: \${func.name}\`, e);
      return false;
    }
  }));

  console.log(\`Warm Up Finished with \${invokes.filter(r => !r).length} invoke errors\`);
}`

    /** Write warm up file */
    return fs.outputFileAsync(this.warmupOpts.pathFile, warmUpFunction)
  }

  /**
   * @description Add warm up function to service
   *
   * @return {Object} Warm up service function object
   * */
  addWarmUpFunctionToService () {
    /** SLS warm up function */
    this.serverless.service.functions.warmUpPlugin = {
      description: 'Serverless WarmUP Plugin',
      events: this.warmupOpts.schedule.map(schedule => ({ schedule })),
      handler: this.warmupOpts.pathHandler,
      memorySize: this.warmupOpts.memorySize,
      name: this.warmupOpts.name,
      runtime: 'nodejs8.10',
      package: {
        individually: true,
        exclude: ['**'],
        include: [this.warmupOpts.folderName + '/**']
      },
      timeout: this.warmupOpts.timeout
    }

    if (this.warmupOpts.role) {
      this.serverless.service.functions.warmUpPlugin.role = this.warmupOpts.role
    }

    if (this.warmupOpts.tags) {
      this.serverless.service.functions.warmUpPlugin.tags = this.warmupOpts.tags
    }

    /** Return service function object */
    return this.serverless.service.functions.warmUpPlugin
  }

  /**
   * @description Warm up the functions immediately after deployment
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  warmUpFunctions () {
    this.serverless.cli.log('WarmUP: Pre-warming up your functions')

    const params = {
      FunctionName: this.warmupOpts.name,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: process.env.SERVERLESS_ALIAS || '$LATEST',
      Payload: this.warmupOpts.source
    }

    return this.provider.request('Lambda', 'invoke', params)
      .then(() => this.serverless.cli.log('WarmUp: Functions sucessfuly pre-warmed'))
      .catch(error => this.serverless.cli.log('WarmUp: Error while pre-warming functions', error))
  }
}

/** Export WarmUP class */
module.exports = WarmUP
