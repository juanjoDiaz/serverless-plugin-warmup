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
    return this.cleanFolder()
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
    this.configPlugin()

    if (this.warmupOpts.prewarm) {
      return this.warmUpFunctions()
    }
  }

  getGlobalConfig (possibleConfig, defaultOpts = {}) {
    const folderName = (typeof possibleConfig.folderName === 'string') ? possibleConfig.folderName : '_warmup'
    const pathFolder = path.join(this.serverless.config.servicePath, folderName)

    return {
      folderName,
      pathFolder,
      pathFile: `${pathFolder}/index.js`,
      pathHandler: `${folderName}/index.warmUp`,
      cleanFolder: (typeof possibleConfig.cleanFolder === 'boolean') ? possibleConfig.cleanFolder : defaultOpts.cleanFolder,
      name: (typeof possibleConfig.name === 'string') ? possibleConfig.name : defaultOpts.name,
      role: (typeof possibleConfig.role === 'string') ? possibleConfig.role : defaultOpts.role,
      tags: (typeof possibleConfig.tags === 'object') ? possibleConfig.tags : defaultOpts.tags,
      schedule: (typeof possibleConfig.schedule === 'string') ? [possibleConfig.schedule]
        : (Array.isArray(possibleConfig.schedule)) ? possibleConfig.schedule : defaultOpts.schedule,
      memorySize: (typeof possibleConfig.memorySize === 'number') ? possibleConfig.memorySize : defaultOpts.memorySize,
      timeout: (typeof possibleConfig.timeout === 'number') ? possibleConfig.timeout : defaultOpts.timeout,
      prewarm: (typeof possibleConfig.prewarm === 'boolean') ? possibleConfig.prewarm : defaultOpts.prewarm,
      concurrency: (typeof possibleConfig.concurrency === 'number') ? possibleConfig.concurrency : defaultOpts.concurrency
    }
  }

  getFunctionConfig (possibleConfig, defaultOpts) {
    if (typeof possibleConfig === 'undefined') {
      return defaultOpts
    }

    if (typeof possibleConfig !== 'object') {
      return Object.assign({}, defaultOpts, { enabled: possibleConfig })
    }

    // Keep backwards compatibility for now
    if (possibleConfig.default) {
      possibleConfig.enabled = possibleConfig.default
    }

    return {
      enabled: (typeof possibleConfig.enabled === 'boolean' ||
          typeof possibleConfig.enabled === 'string' ||
          Array.isArray(possibleConfig.enabled))
        ? possibleConfig.enabled
        : defaultOpts.enabled,
      source: (typeof possibleConfig.source !== 'undefined')
        ? (possibleConfig.sourceRaw ? possibleConfig.source : JSON.stringify(possibleConfig.source))
        : (defaultOpts.sourceRaw ? defaultOpts.source : JSON.stringify(defaultOpts.source))
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
      prewarm: false,
      concurrency: 1
    }

    const functionDefaultOpts = {
      enabled: false,
      source: JSON.stringify({ source: 'serverless-plugin-warmup' })
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
    if (!this.warmupOpts.cleanFolder) {
      return Promise.resolve()
    }
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
    const allFunctions = this.serverless.service.getAllFunctions()
      .map(functionName => this.serverless.service.getFunction(functionName))
      .map(functionConfig => ({
        name: functionConfig.name,
        config: this.getFunctionConfig(functionConfig.warmup, this.warmupOpts)
      }))

    /** Filter functions for warm up */
    const functionsToWarmup = allFunctions.filter((func) => {
      const config = func.config.enabled
      return config === true ||
        config === this.options.stage ||
        (Array.isArray(config) && config.indexOf(this.options.stage) !== -1)
    })

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
    /** Get necessary function info */
    let functions = functionNames.map((functionName) => {
      let functionInfo = {}
      const functionObject = this.serverless.service.getFunction(functionName)
      functionInfo.name = functionObject.name
      functionInfo.concurrency = typeof functionObject.warmupConcurrency === 'number'
        ? functionObject.warmupConcurrency : this.warmup.concurrency
      this.serverless.cli.log(`WarmUP: ${functionInfo.name} concurrency: ${functionInfo.concurrency}`)
      return functionInfo
    })

    const warmUpFunction = `"use strict";

/** Generated by Serverless WarmUP Plugin at ${new Date().toISOString()} */
const aws = require("aws-sdk");
aws.config.region = "${this.options.region}";
const lambda = new aws.Lambda();
const functions = ${JSON.stringify(functions)};

module.exports.warmUp = async (event, context, callback) => {
  console.log("Warm Up Start");
  
  const invokes = await Promise.all(functions.map(async (functionInfo) => {
    console.log(\`Warming up function: \${functionInfo.name} with concurrency: \${functionInfo.concurrency}\`);
    
    const params = {
      ClientContext: "${Buffer.from(`{"custom":${this.warmup.source}}`).toString('base64')}",
      FunctionName: functionInfo.name,
      InvocationType: "RequestResponse",
      LogType: "None",
      Qualifier: process.env.SERVERLESS_ALIAS || "$LATEST",
      Payload: func.config.source
    };
    
    try {
      await Promise.all(Array(functionInfo.concurrency).fill(0)
        .map(async _ => await lambda.invoke(params).promise()))
      console.log(\`Warm Up Invoke Success: \${functionInfo.name}\`);
      return true;
    } catch (e) {
      console.log(\`Warm Up Invoke Error: \${functionInfo.name}\`, e);
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
      .then(data => this.serverless.cli.log('WarmUp: Functions sucessfuly pre-warmed'))
      .catch(error => this.serverless.cli.log('WarmUp: Error while pre-warming functions', error))
  }
}

/** Export WarmUP class */
module.exports = WarmUP
