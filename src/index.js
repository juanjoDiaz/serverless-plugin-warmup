/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'fs-extra'
 * @requires 'path'
 * */
const fs = require('fs-extra');
const path = require('path');

/**
 * @classdesc Keep your lambdas warm during winter
 * @class WarmUp
 * */
class WarmUp {
  /**
   * @description Serverless Warm Up
   * @constructor
   *
   * @param {!Object} serverless - Serverless object
   * @param {!Object} options - Serverless options
   * */
  constructor(serverless, options) {
    /** Serverless variables */
    this.serverless = serverless;
    this.options = options;

    this.provider = this.serverless.getProvider('aws');

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this),
    };
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  async afterPackageInitialize() {
    this.resolvedOptions = this.getResolvedStageAndRegion();
    this.warmupOpts = this.configPlugin(this.serverless.service, this.resolvedOptions.stage);
    this.functionsToWarmup = WarmUp.getFunctionsToBeWarmedUp(
      this.serverless.service,
      this.resolvedOptions.stage,
      this.warmupOpts,
    );

    if (!this.functionsToWarmup.length) {
      this.serverless.cli.log('WarmUp: no functions to warm up');
      return;
    }

    await this.createWarmUpFunctionArtifact(
      this.functionsToWarmup,
      this.resolvedOptions.region,
      this.warmupOpts.pathFile,
    );
    this.addWarmUpFunctionToService();
  }

  /**
   * @description After create deployment artifacts. Clean prefix folder.
   *
   * @fulfil {} — Optimization finished
   * @reject {Error} Optimization error
   *
   * @return {Promise}
   * */
  async afterCreateDeploymentArtifacts() {
    this.resolvedOptions = this.resolvedOptions || this.getResolvedStageAndRegion();
    this.warmupOpts = this.warmupOpts
      || this.configPlugin(this.serverless.service, this.resolvedOptions.stage);
    if (this.warmupOpts.cleanFolder) {
      await this.cleanFolder();
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
  async afterDeployFunctions() {
    this.resolvedOptions = this.resolvedOptions || this.getResolvedStageAndRegion();
    this.warmupOpts = this.warmupOpts
      || this.configPlugin(this.serverless.service, this.resolvedOptions.stage);
    if (this.warmupOpts.prewarm) {
      this.functionsToWarmup = this.functionsToWarmup || WarmUp.getFunctionsToBeWarmedUp(
        this.serverless.service,
        this.resolvedOptions.stage,
        this.warmupOpts,
      );

      if (this.functionsToWarmup.length <= 0) {
        this.serverless.cli.log('WarmUp: no functions to prewarm');
        return;
      }

      await this.warmUpFunctions();
    }
  }

  /**
   * @description Get the stage and region properly resolved
   * See https://github.com/serverless/serverless/issues/2631
   *
   * @return {Object} - Stage and region options
   * */
  getResolvedStageAndRegion() {
    return {
      stage: this.options.stage
        || this.serverless.service.provider.stage
        || (this.serverless.service.defaults && this.serverless.service.defaults.stage)
        || 'dev',
      region: this.options.region
        || this.serverless.service.provider.region
        || (this.serverless.service.defaults && this.serverless.service.defaults.region)
        || 'us-east-1',
    };
  }

  /**
   * @description Clean a global configuration object
   * and fill the missing options using the given defaults
   *
   * @return {Object} - Global configuration options
   * */
  getGlobalConfig(possibleConfig, defaultOpts) {
    const config = (typeof possibleConfig === 'object') ? possibleConfig : {};
    const folderName = (typeof config.folderName === 'string') ? config.folderName : '_warmup';
    const pathFolder = path.join(this.serverless.config.servicePath, folderName);

    /* eslint-disable no-nested-ternary */
    // Keep backwards compatibility for now
    config.events = (typeof config.schedule === 'string')
      ? [{ schedule: config.schedule }]
      : (Array.isArray(config.schedule))
        ? config.schedule.map(schedule => ({ schedule }))
        : config.events;

    return {
      folderName,
      pathFolder,
      pathFile: `${pathFolder}/index.js`,
      pathHandler: `${folderName}/index.warmUp`,
      cleanFolder: (typeof config.cleanFolder === 'boolean') ? config.cleanFolder : defaultOpts.cleanFolder,
      name: (typeof config.name === 'string') ? config.name : defaultOpts.name,
      role: (typeof config.role === 'string') ? config.role : defaultOpts.role,
      tags: (typeof config.tags === 'object') ? config.tags : defaultOpts.tags,
      vpc: config.vpc === false ? { securityGroupIds: [], subnetIds: [] }
        : (typeof config.vpc === 'object' ? config.vpc : defaultOpts.vpc),
      events: (Array.isArray(config.events)) ? config.events : defaultOpts.events,
      package: typeof config.package === 'object'
        ? {
          individually: typeof config.package.individually === 'boolean'
            ? config.package.individually
            : defaultOpts.package.individually,
          exclude: Array.isArray(config.package.exclude)
            ? config.package.exclude
            : defaultOpts.package.exclude,
          include: Array.isArray(config.package.include)
            ? (config.package.include.includes(`${folderName}/**`)
              ? config.package.include
              : config.package.include.concat([`${folderName}/**`]))
            : [`${folderName}/**`],
        }
        : Object.assign(defaultOpts.package, { include: [`${folderName}/**`] }),
      memorySize: (typeof config.memorySize === 'number') ? config.memorySize : defaultOpts.memorySize,
      timeout: (typeof config.timeout === 'number') ? config.timeout : defaultOpts.timeout,
      environment: (typeof config.environment === 'object') ? config.environment : defaultOpts.environment,
      prewarm: (typeof config.prewarm === 'boolean') ? config.prewarm : defaultOpts.prewarm,
    };
    /* eslint-enable no-nested-ternary */
  }

  /**
   * @description Clean a function-specific configuration object
   * and fill the missing options using the given defaults
   *
   * @return {Object} - Function-specific configuration options
   * */
  static getFunctionConfig(possibleConfig, defaultOpts) {
    const config = (['boolean', 'string'].includes(typeof possibleConfig) || Array.isArray(possibleConfig))
      ? { enabled: possibleConfig }
      : (possibleConfig || {});

    // Keep backwards compatibility for now
    if (config.default) {
      config.enabled = possibleConfig.default;
    }
    if (config.source) {
      config.payload = possibleConfig.source;
    }
    if (config.sourceRaw) {
      config.payloadRaw = config.sourceRaw;
    }

    /* eslint-disable no-nested-ternary */
    return {
      enabled: (typeof config.enabled === 'boolean'
          || typeof config.enabled === 'string'
          || Array.isArray(config.enabled))
        ? config.enabled
        : defaultOpts.enabled,
      payload: (typeof config.payload !== 'undefined')
        ? (config.payloadRaw ? config.payload : JSON.stringify(config.payload))
        : defaultOpts.payload,
      concurrency: (typeof config.concurrency === 'number') ? config.concurrency : defaultOpts.concurrency,
    };
    /* eslint-enable no-nested-ternary */
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {Object} - Configuration options to be used by the plugin
   * */
  configPlugin(service, stage) {
    const globalDefaultOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      memorySize: 128,
      name: `${service.service}-${stage}-warmup-plugin`,
      events: [{ schedule: 'rate(5 minutes)' }],
      package: {
        individually: true,
        exclude: ['**'],
      },
      timeout: 10,
      environment: Object.keys(service.provider.environment || [])
        .reduce((obj, k) => Object.assign({}, obj, { [k]: undefined }), {}),
      prewarm: false,
    };

    const functionDefaultOpts = {
      enabled: false,
      payload: JSON.stringify({ source: 'serverless-plugin-warmup' }),
      concurrency: 1,
    };

    const customConfig = service.custom ? service.custom.warmup : undefined;

    return Object.assign(
      this.getGlobalConfig(customConfig, globalDefaultOpts),
      WarmUp.getFunctionConfig(customConfig, functionDefaultOpts),
    );
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @return {Array} - List of functions to be warmed up and their specific configs
   * */
  static getFunctionsToBeWarmedUp(service, stage, warmupOpts) {
    return service.getAllFunctions()
      .map(name => service.getFunction(name))
      .map(config => ({
        name: config.name,
        config: WarmUp.getFunctionConfig(config.warmup, warmupOpts),
      }))
      .filter(({ config: { enabled } }) => (
        enabled === true
        || enabled === 'true'
        || enabled === stage
        || (Array.isArray(enabled) && enabled.indexOf(stage) !== -1)
      ));
  }

  /**
   * @description Clean prefix folder
   *
   * @fulfil {} — Folder cleaned
   * @reject {Error} File system error
   *
   * @return {Promise}
   * */
  async cleanFolder() {
    return fs.remove(this.warmupOpts.pathFolder);
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
  async createWarmUpFunctionArtifact(functions, region, pathFile) {
    /** Log warmup start */
    this.serverless.cli.log(`WarmUp: setting ${functions.length} lambdas to be warm`);

    /** Log functions being warmed up */
    functions.forEach(func => this.serverless.cli.log(`WarmUp: ${func.name}`));

    const warmUpFunction = `"use strict";

/** Generated by Serverless WarmUp Plugin at ${new Date().toISOString()} */
const aws = require("aws-sdk");
aws.config.region = "${region}";
const lambda = new aws.Lambda();
const functions = ${JSON.stringify(functions)};

module.exports.warmUp = async (event, context) => {
  console.log("Warm Up Start");
  
  const invokes = await Promise.all(functions.map(async (func) => {
    console.log(\`Warming up function: \${func.name} with concurrency: \${func.config.concurrency}\`);
    
    const params = {
      ClientContext: Buffer.from(\`{"custom":\${func.config.payload}}\`).toString('base64'),
      FunctionName: func.name,
      InvocationType: "RequestResponse",
      LogType: "None",
      Qualifier: process.env.SERVERLESS_ALIAS || "$LATEST",
      Payload: func.config.payload
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
}`;

    /** Write warm up file */
    return fs.outputFile(pathFile, warmUpFunction);
  }

  /**
   * @description Add warm up function to service
   * */
  addWarmUpFunctionToService() {
    /** SLS warm up function */
    this.serverless.service.functions.warmUpPlugin = Object.assign(
      {
        description: 'Serverless WarmUp Plugin',
        events: this.warmupOpts.events,
        handler: this.warmupOpts.pathHandler,
        memorySize: this.warmupOpts.memorySize,
        name: this.warmupOpts.name,
        runtime: 'nodejs8.10',
        package: this.warmupOpts.package,
        timeout: this.warmupOpts.timeout,
        environment: this.warmupOpts.environment,
      },
      this.warmupOpts.role ? { role: this.warmupOpts.role } : {},
      this.warmupOpts.tags ? { tags: this.warmupOpts.tags } : {},
      this.warmupOpts.vpc ? { vpc: this.warmupOpts.vpc } : {},
    );
  }

  /**
   * @description Warm up the functions immediately after deployment
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  async warmUpFunctions() {
    this.serverless.cli.log('WarmUp: Pre-warming up your functions');

    try {
      const params = {
        FunctionName: this.warmupOpts.name,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Qualifier: process.env.SERVERLESS_ALIAS || '$LATEST',
        Payload: this.warmupOpts.payload,
      };

      await this.provider.request('Lambda', 'invoke', params);
      this.serverless.cli.log('WarmUp: Functions sucessfuly pre-warmed');
    } catch (err) {
      this.serverless.cli.log('WarmUp: Error while pre-warming functions', err);
    }
  }
}

/** Export WarmUp class */
module.exports = WarmUp;
