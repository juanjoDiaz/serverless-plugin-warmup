'use strict'

/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'fs-extra'
 * @requires 'path'
 * */
const fs = require('fs-extra')
const path = require('path')
const { ensureObject, isType, isObject, Validator } = require('./helpers')

const DEFAULT = {
  STAGE: 'dev',
  REGION: 'us-east-1'
}

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
    const { service } = serverless
    service.defaults = ensureObject(service.defaults)

    // See https://github.com/serverless/serverless/issues/2631
    this.options = new Validator(options)
      .withTypes({
        stage: { type: 'string' },
        region: { type: 'string' }
      })
      .withDefaults({
        stage:
          service.provider.stage || service.defaults.stage || DEFAULT.STAGE,
        region:
          service.provider.region || service.defaults.region || DEFAULT.REGION
      })
      .validate()

    this.provider = this.serverless.getProvider('aws')

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(
        this
      ),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this)
    }

    this.warmupOpts = this.configPlugin(
      this.serverless.service,
      this.options.stage
    )
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  afterPackageInitialize () {
    this.functionsToWarmup = this.getFunctionsToBeWarmedUp(
      this.serverless.service,
      this.options.stage,
      this.warmupOpts
    )

    if (this.functionsToWarmup.length === 0) {
      this.serverless.cli.log('WarmUP: no functions to warm up')
      return Promise.resolve()
    }

    return this.createWarmUpFunctionArtifact(this.functionsToWarmup).then(() =>
      this.addWarmUpFunctionToService(this.warmupOpts)
    )
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
    if (this.warmupOpts.cleanFolder !== true) {
      return Promise.resolve()
    }

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
    if (!Array.isArray(this.functionsToWarmup)) {
      this.functionsToWarmup = this.getFunctionsToBeWarmedUp(
        this.serverless.service,
        this.options.stage,
        this.warmupOpts
      )
    }

    if (
      this.warmupOpts.prewarm !== true ||
      this.functionsToWarmup.length === 0
    ) {
      this.serverless.cli.log('WarmUP: no functions to prewarm')
      return Promise.resolve()
    }

    return this.warmUpFunctions()
  }

  /**
   * @description Clean a global configuration object
   * and fill the missing options using the given defaults
   *
   * @return {Object} - Global configuration options
   * */
  getGlobalConfig (possibleConfig, defaultOpts) {
    const config = ensureObject(possibleConfig)
    const folderName =
      typeof config.folderName === 'string' ? config.folderName : '_warmup'
    const pathFolder = path.join(
      this.serverless.config.servicePath,
      folderName
    )

    // Keep backwards compatibility for now
    if (typeof config.schedule === 'string') {
      config.events = [{ schedule: config.schedule }]
    } else if (Array.isArray(config.schedule)) {
      config.events = config.schedule.map(schedule => ({ schedule }))
    }

    if (config.vpc === false) {
      config.vpc = { securityGroupIds: [], subnetIds: [] }
    }

    return new Validator({
      folderName,
      pathFolder,
      pathFile: `${pathFolder}/index.js`,
      pathHandler: `${folderName}/index.warmUp`,
      cleanFolder: config.cleanFolder,
      name: config.name,
      role: config.role,
      tags: config.tags,
      vpc: config.vpc,
      events: config.events,
      memorySize: config.memorySize,
      timeout: config.timeout,
      prewarm: config.prewarm
    })
      .withTypes({
        folderName: { type: 'string' },
        pathFolder: { type: 'string' },
        pathFile: { type: 'string' },
        pathHandler: { type: 'string' },
        cleanFolder: { type: 'boolean' },
        name: { type: 'string' },
        role: { type: 'string', optional: true },
        tags: { type: 'object', optional: true },
        vpc: { type: 'object', optional: true },
        events: { type: 'array' },
        memorySize: { type: 'number' },
        timeout: { type: 'number' },
        prewarm: { type: 'boolean' }
      })
      .withDefaults(defaultOpts)
      .validate()
  }

  /**
   * @description Clean a function-specific configuration object
   * and fill the missing options using the given defaults
   *
   * @return {Object} - Function-specific configuration options
   * */
  getFunctionConfig (possibleConfig, defaultOpts) {
    const config = ['boolean', 'string', 'array'].some(type =>
      isType(possibleConfig, type)
    )
      ? { enabled: possibleConfig }
      : ensureObject(possibleConfig)

    defaultOpts = ensureObject(defaultOpts)

    // Keep backwards compatibility for now
    if (config.default) {
      config.enabled = config.default
    }

    let source = config.source
    if (config.source && config.sourceRaw !== true) {
      source = JSON.stringify(config.source)
    }

    return new Validator({
      enabled: config.enabled,
      source,
      concurrency: config.concurrency
    })
      .withTypes({
        enabled: { type: ['boolean', 'string', 'array'] },
        source: { type: 'string' },
        concurrency: { type: 'number' }
      })
      .withDefaults(defaultOpts)
      .validate()
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {Object} - Configuration options to be used by the plugin
   * */
  configPlugin (service, stage) {
    const globalDefaultOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      memorySize: 128,
      name: `${service.service}-${stage}-warmup-plugin`,
      events: [{ schedule: 'rate(5 minutes)' }],
      timeout: 10,
      prewarm: false
    }

    const functionDefaultOpts = {
      enabled: false,
      source: JSON.stringify({ source: 'serverless-plugin-warmup' }),
      concurrency: 1
    }

    const customConfig = service.custom ? service.custom.warmup : undefined

    return Object.assign(
      this.getGlobalConfig(customConfig, globalDefaultOpts),
      this.getFunctionConfig(customConfig, functionDefaultOpts)
    )
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @return {Array} - List of functions to be warmed up and their specific configs
   * */
  getFunctionsToBeWarmedUp (service, stage, warmupOpts) {
    return service
      .getAllFunctions()
      .map(name => service.getFunction(name))
      .map(config => ({
        name: config.name,
        config: this.getFunctionConfig(config.warmup, warmupOpts)
      }))
      .filter(
        ({ config: { enabled } }) =>
          enabled === true ||
          enabled === stage ||
          (Array.isArray(enabled) && enabled.includes(stage))
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
    return fs.remove(this.warmupOpts.pathFolder)
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
    this.serverless.cli.log(
      `WarmUP: setting ${functions.length} lambdas to be warm`
    )

    /** Log functions being warmed up */
    functions.forEach(func => this.serverless.cli.log(`WarmUP: ${func.name}`))

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
    return fs.outputFile(this.warmupOpts.pathFile, warmUpFunction)
  }

  /**
   * @description Add warm up function to service
   *
   * @return {Object} Warm up service function object
   * */
  addWarmUpFunctionToService ({
    events,
    pathHandler: handler,
    memorySize,
    name,
    folderName,
    timeout,
    role,
    tags,
    vpc
  }) {
    /** SLS warm up function */
    this.serverless.service.functions.warmUpPlugin = {
      description: 'Serverless WarmUP Plugin',
      events,
      handler,
      memorySize,
      name,
      runtime: 'nodejs8.10',
      package: {
        individually: true,
        exclude: ['**'],
        include: [folderName + '/**']
      },
      timeout
    }

    if (typeof role === 'string') {
      this.serverless.service.functions.warmUpPlugin.role = role
    }

    if (isObject(tags)) {
      this.serverless.service.functions.warmUpPlugin.tags = tags
    }

    if (isObject(vpc)) {
      this.serverless.service.functions.warmUpPlugin.vpc = vpc
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

    return this.provider
      .request('Lambda', 'invoke', params)
      .then(() =>
        this.serverless.cli.log('WarmUp: Functions sucessfuly pre-warmed')
      )
      .catch(error =>
        this.serverless.cli.log(
          'WarmUp: Error while pre-warming functions',
          error
        )
      )
  }
}

/** Export WarmUP class */
module.exports = WarmUP
