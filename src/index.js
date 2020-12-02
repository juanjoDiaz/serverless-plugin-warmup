/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'fs'
 * @requires 'path'
 * */
const fs = require('fs').promises;
const path = require('path');

const capitalize = (name) => name.charAt(0).toUpperCase() + name.slice(1);

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

    this.extendServerlessSchema();

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this),
    };
  }

  /**
   * @description Define the additions to the serverless schema by this plugin.
   * */
  extendServerlessSchema() {
    // Most of these are taken from
    // https://github.com/serverless/serverless/blob/master/lib/configSchema.js
    // https://github.com/serverless/serverless/blob/master/lib/plugins/aws/provider/awsProvider.js
    // https://github.com/serverless/serverless/blob/master/lib/plugins/aws/package/compile/events/schedule/index.js

    const rateSyntax = '^rate\\((?:1 (?:minute|hour|day)|(?:1\\d+|[2-9]\\d*) (?:minute|hour|day)s)\\)$';
    const cronSyntax = '^cron\\(\\S+ \\S+ \\S+ \\S+ \\S+ \\S+\\)$';
    const scheduleSyntax = `${rateSyntax}|${cronSyntax}`;

    const globalConfigSchemaProperties = {
      folderName: { type: 'string' },
      cleanFolder: { type: 'boolean' },
      name: { type: 'string' },
      role: { $ref: '#/definitions/awsLambdaRole' },
      tags: { $ref: '#/definitions/awsResourceTags' },
      vpc: { $ref: '#/definitions/awsLambdaVpcConfig' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          anyOf: [
            { type: 'string', pattern: scheduleSyntax },
            {
              type: 'object',
              properties: {
                rate: { type: 'string', pattern: scheduleSyntax },
                enabled: { type: 'boolean' },
                name: {
                  type: 'string', minLength: 1, maxLength: 64, pattern: '[\\.\\-_A-Za-z0-9]+',
                },
                description: { type: 'string', maxLength: 512 },
                // input: {
                //   anyOf: [
                //     { type: 'string', maxLength: 8192 },
                //     {
                //       type: 'object',
                //       oneOf: [
                //         {
                //           properties: {
                //             body: { type: 'string', maxLength: 8192 },
                //           },
                //           required: ['body'],
                //           additionalProperties: false,
                //         },
                //         {
                //           not: {
                //             required: ['body'],
                //           },
                //         },
                //       ],
                //     },
                //   ],
                // },
                // inputPath: { type: 'string', maxLength: 256 },
                // inputTransformer: {
                //   type: 'object',
                //   properties: {
                //     inputTemplate: {
                //       type: 'string',
                //       minLength: 1,
                //       maxLength: 8192,
                //     },
                //     inputPathsMap: { type: 'object' },
                //   },
                //   required: ['inputTemplate'],
                //   additionalProperties: false,
                // },
              },
              required: ['rate'],
              additionalProperties: false,
            },
          ],
        },
      },
      package: {
        type: 'object',
        properties: {
          artifact: { type: 'string' },
          exclude: { type: 'array', items: { type: 'string' } },
          include: { type: 'array', items: { type: 'string' } },
          individually: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      memorySize: { $ref: '#/definitions/awsLambdaMemorySize' },
      timeout: { $ref: '#/definitions/awsLambdaTimeout' },
      environment: { $ref: '#/definitions/awsLambdaEnvironment' },
      prewarm: { type: 'boolean' },
    };

    const functionConfigSchemaProperties = {
      enabled: {
        anyOf: [
          { type: 'boolean' },
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      clientContext: { type: 'object' }, // any
      payload: { type: 'object' }, // any
      payloadRaw: { type: 'boolean' },
      concurrency: { type: 'integer' },
    };

    this.serverless.configSchemaHandler.defineCustomProperties({
      type: 'object',
      properties: {
        warmup: {
          '.*': {
            type: 'object',
            properties: { ...globalConfigSchemaProperties, ...functionConfigSchemaProperties },
            additionalProperties: false,
          },
        },
      },
    });

    this.serverless.configSchemaHandler.defineFunctionProperties('aws', {
      type: 'object',
      properties: {
        warmup: {
          '.*': {
            type: 'object',
            properties: { functionConfigSchemaProperties },
            additionalProperties: false,
          },
        },
      },
    });
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
    this.warmupConfigByWarmer = WarmUp.configPlugin(
      this.serverless.service,
      this.resolvedOptions.stage,
    );

    this.functionsByWarmer = WarmUp.getFunctionsByWarmer(
      this.serverless.service,
      this.resolvedOptions.stage,
      this.warmupConfigByWarmer,
    );

    if (Object.keys(this.functionsByWarmer).length === 0) {
      this.serverless.cli.log('WarmUp: no functions to warm up for any warmer');
      return;
    }

    await Promise.all(Object.entries(this.warmupConfigByWarmer)
      .map(([warmerName, warmerConfig]) => this.configureWarmer(
        warmerName,
        warmerConfig,
        this.functionsByWarmer[warmerName],
      )));
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
    this.warmupConfigByWarmer = this.warmupConfigByWarmer
      || WarmUp.configPlugin(this.serverless.service, this.resolvedOptions.stage);

    const foldersToClean = Array.from(new Set(Object.values(this.warmupConfigByWarmer)
      .filter((config) => config.cleanFolder)
      .map((config) => config.folderName)));

    await Promise.all(foldersToClean.map(async (folderToClean) => {
      try {
        await WarmUp.cleanFolder(path.join(this.serverless.config.servicePath, folderToClean));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.serverless.cli.log(`WarmUp: couldn't clean up temporary folder ${folderToClean}`);
        }
      }
    }));
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
    this.warmupConfigByWarmer = this.warmupConfigByWarmer
      || WarmUp.configPlugin(this.serverless.service, this.resolvedOptions.stage);

    this.functionsByWarmer = this.functionsToWarmup || WarmUp.getFunctionsByWarmer(
      this.serverless.service,
      this.resolvedOptions.stage,
      this.warmupConfigByWarmer,
    );

    if (Object.keys(this.functionsByWarmer).length === 0) {
      this.serverless.cli.log('WarmUp: no functions to prewarm');
      return;
    }

    await Promise.all(Object.entries(this.warmupConfigByWarmer)
      .filter(([, warmerConfig]) => warmerConfig.prewarm)
      .map(async ([warmerName, warmerConfig]) => {
        WarmUp.addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
        await this.invokeWarmer(warmerName, warmerConfig, this.functionsByWarmer[warmerName]);
      }));
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
  static getWarmerConfig(possibleConfig, defaultOpts) {
    const config = (typeof possibleConfig === 'object') ? possibleConfig : {};
    const folderName = path.join((typeof config.folderName === 'string') ? config.folderName : defaultOpts.folderName);

    /* eslint-disable no-nested-ternary */
    return {
      folderName,
      pathHandler: `${folderName}/index.warmUp`,
      cleanFolder: (typeof config.cleanFolder === 'boolean') ? config.cleanFolder : defaultOpts.cleanFolder,
      name: (config.name !== undefined) ? config.name : defaultOpts.name,
      role: (config.role !== undefined) ? config.role : defaultOpts.role,
      tags: (config.tags !== undefined) ? config.tags : defaultOpts.tags,
      vpc: config.vpc === false ? { securityGroupIds: [], subnetIds: [] }
        : (config.vpc !== undefined ? config.vpc : defaultOpts.vpc),
      events: (Array.isArray(config.events)) ? config.events : defaultOpts.events,
      package: typeof config.package === 'object'
        ? {
          individually: (config.package.individually !== undefined)
            ? config.package.individually
            : defaultOpts.package.individually,
          exclude: Array.isArray(config.package.exclude)
            ? config.package.exclude
            : defaultOpts.package.exclude,
          include: Array.isArray(config.package.include)
            ? (config.package.include.includes(`${folderName}/**`)
              ? config.package.include
              : [...config.package.include, `${folderName}/**`])
            : [...defaultOpts.package.include, `${folderName}/**`],
        }
        : {
          ...defaultOpts.package,
          include: [...defaultOpts.package.include, `${folderName}/**`],
        },
      memorySize: (config.memorySize !== undefined) ? config.memorySize : defaultOpts.memorySize,
      timeout: (config.timeout !== undefined) ? config.timeout : defaultOpts.timeout,
      environment: (config.environment !== undefined)
        ? config.environment
        : defaultOpts.environment,
      prewarm: (config.prewarm !== undefined) ? config.prewarm : defaultOpts.prewarm,
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

    /* eslint-disable no-nested-ternary */
    return {
      enabled: (config.enabled !== undefined)
        ? config.enabled
        : defaultOpts.enabled,
      clientContext: (config.clientContext !== undefined)
        ? config.clientContext && JSON.stringify(config.clientContext)
        : defaultOpts.clientContext,
      payload: (config.payload !== undefined)
        ? (config.payloadRaw ? config.payload : JSON.stringify(config.payload))
        : defaultOpts.payload,
      concurrency: (config.concurrency !== undefined)
        ? config.concurrency
        : defaultOpts.concurrency,
    };
    /* eslint-enable no-nested-ternary */
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {Object} - Configuration options to be used by the plugin
   * */
  static configPlugin(service, stage) {
    const getWarmerDefaultOpts = (warmerName) => ({
      folderName: path.join('_warmup', warmerName),
      cleanFolder: true,
      memorySize: 128,
      name: `${service.service}-${stage}-warmup-plugin-${warmerName}`,
      events: [{ schedule: 'rate(5 minutes)' }],
      package: {
        individually: true,
        // Negating the includes to work around https://github.com/serverless/serverless/issues/8093
        include: service.package && service.package.include
          ? service.package.include
            .filter((pattern) => !pattern.startsWith('!'))
            .map((pattern) => `!${pattern}`)
          : [],
        exclude: ['**'],
      },
      timeout: 10,
      environment: Object.keys(service.provider.environment || [])
        .reduce((obj, k) => ({ ...obj, [k]: undefined }), {}),
      prewarm: false,
    });

    const functionDefaultOpts = {
      enabled: false,
      clientContext: undefined,
      payload: JSON.stringify({ source: 'serverless-plugin-warmup' }),
      concurrency: 1,
    };

    return Object.entries(service.custom ? service.custom.warmup : {})
      .reduce((warmers, [warmerName, warmerConfig]) => ({
        ...warmers,
        [warmerName]: {
          ...WarmUp.getWarmerConfig(warmerConfig, getWarmerDefaultOpts(warmerName)),
          ...WarmUp.getFunctionConfig(warmerConfig, functionDefaultOpts),
        },
      }), {});
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @return {Array} - List of functions to be warmed up and their specific configs
   * */
  static getFunctionsByWarmer(service, stage, warmupConfigByWarmer) {
    const functions = service.getAllFunctions()
      .map((name) => service.getFunction(name))
      .map((config) => {
        if (config.warmup === undefined) {
          return {
            name: config.name,
            config: Object.entries(warmupConfigByWarmer)
              .reduce((warmers, [warmerName, warmerConfig]) => ({
                ...warmers,
                [warmerName]: WarmUp.getFunctionConfig({}, warmerConfig),
              }), {}),
          };
        }

        const unknownWarmers = Object.keys(config.warmup)
          .filter((warmerName) => warmupConfigByWarmer[warmerName] === undefined);
        if (unknownWarmers.length > 0) {
          throw new Error(`WarmUp: Invalid function-level warmup configuration (${unknownWarmers.join(', ')}) in function ${config.name}. Every warmer should be declared in the custom section.`);
        }

        return {
          name: config.name,
          config: Object.entries(warmupConfigByWarmer)
            .reduce((warmers, [warmerName, warmerConfig]) => ({
              ...warmers,
              [warmerName]: WarmUp.getFunctionConfig(config.warmup[warmerName], warmerConfig),
            }), {}),
        };
      });

    function isEnabled(enabled) {
      return enabled === true
         || enabled === 'true'
         || enabled === stage
         || (Array.isArray(enabled) && enabled.indexOf(stage) !== -1);
    }

    return functions.reduce((warmersAcc, fn) => {
      Object.entries(fn.config)
        .forEach(([warmerName, config]) => {
          if (!isEnabled(config.enabled)) return;
          // eslint-disable-next-line no-param-reassign
          if (!warmersAcc[warmerName]) warmersAcc[warmerName] = [];
          warmersAcc[warmerName].push({ name: fn.name, config });
        });
      return warmersAcc;
    }, {});
  }

  /**
   * @description Clean prefix folder
   *
   * @fulfil {} — Folder cleaned
   * @reject {Error} File system error
   *
   * @return {Promise}
   * */
  static async cleanFolder(folderToClean) {
    const files = await fs.readdir(folderToClean);
    await Promise.all(files.map((file) => fs.unlink(path.join(folderToClean, file))));
    await fs.rmdir(folderToClean);
  }

  /**
   * @description Create warm up function code and write it to the handler file
   *
   * @param {Array} functions - Functions to be warmed up
   *
   * @fulfil {} — Warm up function created
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  static async createWarmUpFunctionArtifact(functions, region, filePath) {
    const warmUpFunction = `'use strict';

/** Generated by Serverless WarmUp Plugin at ${new Date().toISOString()} */

const aws = require('aws-sdk');
aws.config.region = '${region}';
const lambda = new aws.Lambda();
const functions = ${JSON.stringify(functions)};

module.exports.warmUp = async (event, context) => {
  console.log('Warm Up Start');

  const invokes = await Promise.all(functions.map(async (func) => {
    let concurrency;
    const functionConcurrency = process.env[\`WARMUP_CONCURRENCY_\${func.name.toUpperCase().replace(/-/g, '_')}\`];

    if (functionConcurrency) {
      concurrency = parseInt(functionConcurrency);
      console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency} (from function-specific environment variable)\`);
    } else if (process.env.WARMUP_CONCURRENCY) {
      concurrency = parseInt(process.env.WARMUP_CONCURRENCY);
      console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency} (from global environment variable)\`);
    } else {
      concurrency = parseInt(func.config.concurrency);
      console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency}\`);
    }

    const clientContext = func.config.clientContext !== undefined
      ? func.config.clientContext
      : func.config.payload;

    const params = {
      ClientContext: clientContext
        ? Buffer.from(\`{"custom":\${clientContext}}\`).toString('base64')
        : undefined,
      FunctionName: func.name,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: process.env.SERVERLESS_ALIAS,
      Payload: func.config.payload
    };

    try {
      await Promise.all(Array(concurrency).fill(0).map(async () => await lambda.invoke(params).promise()));
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
    await fs.writeFile(filePath, warmUpFunction);
  }

  /**
   * @description Add warmer function to service
   * */
  static addWarmUpFunctionToService(service, warmerName, warmerConfig) {
    // eslint-disable-next-line no-param-reassign
    service.functions[`warmUpPlugin${capitalize(warmerName)}`] = {
      description: 'Serverless WarmUp Plugin',
      events: warmerConfig.events,
      handler: warmerConfig.pathHandler,
      memorySize: warmerConfig.memorySize,
      name: warmerConfig.name,
      runtime: 'nodejs12.x',
      package: warmerConfig.package,
      timeout: warmerConfig.timeout,
      ...(Object.keys(warmerConfig.environment).length
        ? { environment: warmerConfig.environment }
        : {}),
      ...(warmerConfig.role ? { role: warmerConfig.role } : {}),
      ...(warmerConfig.tags ? { tags: warmerConfig.tags } : {}),
      ...(warmerConfig.vpc ? { vpc: warmerConfig.vpc } : {}),
    };
  }

  /**
   * @description Create warm up function code and write it to the handler file
   * and add warm up function to the service
   * */
  async configureWarmer(warmerName, warmerConfig, functions) {
    if (functions === undefined || functions.length === 0) {
      this.serverless.cli.log(`WarmUp: no functions to warm up for warmer ${warmerName}`);
      return;
    }

    this.serverless.cli.log(`WarmUp: setting warmer "${warmerName}" to warm up ${functions.length} lambdas`);
    functions.forEach((func) => this.serverless.cli.log(`WarmUp: ${func.name}`));

    const handlerFolder = path.join(this.serverless.config.servicePath, warmerConfig.folderName);

    await fs.mkdir(handlerFolder, { recursive: true });

    await WarmUp.createWarmUpFunctionArtifact(
      functions,
      this.resolvedOptions.region,
      path.join(handlerFolder, 'index.js'),
    );

    WarmUp.addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
  }

  async invokeWarmer(warmerName, warmerConfig, functions) {
    if (functions === undefined || functions.length === 0) {
      this.serverless.cli.log(`WarmUp: no functions to warm up for warmer ${warmerName}`);
      return;
    }

    this.serverless.cli.log(`WarmUp: Pre-warming up you functions using warmer "${warmerName}"`);

    try {
      const { SERVERLESS_ALIAS } = this.serverless.service.getFunction(`warmUpPlugin${capitalize(warmerName)}`).environment || {};
      const params = {
        FunctionName: warmerConfig.name,
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Qualifier: SERVERLESS_ALIAS,
        Payload: warmerConfig.payload,
      };

      await this.provider.request('Lambda', 'invoke', params);
      this.serverless.cli.log(`WarmUp: Warmer "${warmerName}" successfully pre-warmed your functions`);
    } catch (err) {
      this.serverless.cli.log(`WarmUp: Error while pre-warming your functions using warmer "${warmerName}"`, err);
    }
  }
}

/** Export WarmUp class */
module.exports = WarmUp;
