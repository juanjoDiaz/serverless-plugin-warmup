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

    WarmUp.extendServerlessSchema(this.serverless);

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this),
    };
  }

  /**
   * @description Define the additions to the serverless schema by this plugin.
   * */
  static extendServerlessSchema(serverless) {
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
      vpc: {
        anyOf: [
          { const: false }, // to deploy outside of the VPC
          { $ref: '#/definitions/awsLambdaVpcConfig' },
        ],
      },
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
      clientContext: {
        anyOf: [
          { const: false }, // to skip it
          { type: 'object' }, // any
        ],
      },
      payload: { type: 'object' }, // any
      payloadRaw: { type: 'boolean' },
      concurrency: { type: 'integer' },
    };

    serverless.configSchemaHandler.defineCustomProperties({
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

    serverless.configSchemaHandler.defineFunctionProperties('aws', {
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
    this.stage = this.provider.getStage();

    this.configByWarmer = WarmUp.getConfigByWarmer(this.serverless.service, this.stage);
    this.functionsByWarmer = WarmUp.getFunctionsByWarmer(
      this.serverless.service,
      this.stage,
      this.configByWarmer,
    );

    if (Object.keys(this.functionsByWarmer).length === 0) {
      this.serverless.cli.log('WarmUp: Skipping all warmers creation. No functions to warm up.');
      return;
    }

    await Promise.all(Object.entries(this.configByWarmer)
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
    this.stage = this.stage || this.provider.getStage();
    this.configByWarmer = this.configByWarmer
      || WarmUp.getConfigByWarmer(this.serverless.service, this.stage);

    const foldersToClean = Array.from(new Set(Object.values(this.configByWarmer)
      .filter((config) => config.cleanFolder)
      .map((config) => config.folderName)));

    await Promise.all(foldersToClean.map(async (folderToClean) => {
      try {
        await WarmUp.cleanFolder(path.join(this.serverless.config.servicePath, folderToClean));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.serverless.cli.log(`WarmUp: Couldn't clean up temporary folder ${folderToClean}.`);
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
    this.stage = this.stage || this.provider.getStage();
    this.configByWarmer = this.configByWarmer
      || WarmUp.getConfigByWarmer(this.serverless.service, this.stage);

    this.functionsByWarmer = this.functionsToWarmup || WarmUp.getFunctionsByWarmer(
      this.serverless.service,
      this.stage,
      this.configByWarmer,
    );

    if (Object.keys(this.functionsByWarmer).length === 0) {
      this.serverless.cli.log('WarmUp: Skipping all warmers prewarming. No functions to warm up.');
      return;
    }

    await Promise.all(Object.entries(this.configByWarmer)
      .filter(([, warmerConfig]) => warmerConfig.prewarm)
      .map(async ([warmerName, warmerConfig]) => {
        WarmUp.addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
        await this.invokeWarmer(warmerName, warmerConfig, this.functionsByWarmer[warmerName]);
      }));
  }

  /**
   * @description Clean a global configuration object
   * and fill the missing options using the given defaults
   *
   * @return {Object} - Global configuration options
   * */
  static getWarmerConfig(config = {}, defaultOpts = {}) {
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
  static getFunctionConfig(config = {}, defaultOpts = {}) {
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
  static getConfigByWarmer(service, stage) {
    const getWarmerDefaultOpts = (warmerName) => ({
      folderName: path.join('.warmup', warmerName),
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
  static getFunctionsByWarmer(service, stage, configByWarmer) {
    const functions = service.getAllFunctions()
      .map((name) => service.getFunction(name))
      .map((config) => {
        if (config.warmup === undefined) {
          return {
            name: config.name,
            config: Object.entries(configByWarmer)
              .reduce((warmers, [warmerName, warmerConfig]) => ({
                ...warmers,
                [warmerName]: WarmUp.getFunctionConfig({}, warmerConfig),
              }), {}),
          };
        }

        const unknownWarmers = Object.keys(config.warmup)
          .filter((warmerName) => configByWarmer[warmerName] === undefined);
        if (unknownWarmers.length > 0) {
          throw new Error(`WarmUp: Invalid function-level warmup configuration (${unknownWarmers.join(', ')}) in function ${config.name}. Every warmer should be declared in the custom section.`);
        }

        return {
          name: config.name,
          config: Object.entries(configByWarmer)
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

function getConcurrency(func, envVars) {
  const functionConcurrency = envVars[\`WARMUP_CONCURRENCY_\${func.name.toUpperCase().replace(/-/g, '_')}\`];

  if (functionConcurrency) {
    const concurrency = parseInt(functionConcurrency);
    console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency} (from function-specific environment variable)\`);
    return concurrency;
  }

  if (envVars.WARMUP_CONCURRENCY) {
    const concurrency = parseInt(envVars.WARMUP_CONCURRENCY);
    console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency} (from global environment variable)\`);
    return concurrency;
  }
  
  const concurrency = parseInt(func.config.concurrency);
  console.log(\`Warming up function: \${func.name} with concurrency: \${concurrency}\`);
  return concurrency;
}

module.exports.warmUp = async (event, context) => {
  console.log('Warm Up Start');

  const invokes = await Promise.all(functions.map(async (func) => {
    const concurrency = getConcurrency(func, process.env);

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
      description: `Serverless WarmUp Plugin (warmer "${warmerName}")`,
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
   * @description Add warmer function to service
   * */
  static addWarmUpFunctionRoleToResources(service, stage, warmerName, warmerConfig, functions) {
    // eslint-disable-next-line no-param-reassign
    warmerConfig.role = `WarmUpPlugin${capitalize(warmerName)}Role`;
    if (typeof service.resources !== 'object') {
      // eslint-disable-next-line no-param-reassign
      service.resources = {};
    }
    if (typeof service.resources.Resources !== 'object') {
      // eslint-disable-next-line no-param-reassign
      service.resources.Resources = {};
    }

    // eslint-disable-next-line no-param-reassign
    service.resources.Resources[warmerConfig.role] = {
      Type: 'AWS::IAM::Role',
      Properties: {
        Path: '/',
        RoleName: {
          'Fn::Join': [
            '-',
            [
              service.service,
              stage,
              { Ref: 'AWS::Region' },
              warmerName.toLowerCase(),
              'role',
            ],
          ],
        },
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: {
                Service: [
                  'lambda.amazonaws.com',
                ],
              },
              Action: 'sts:AssumeRole',
            },
          ],
        },
        Policies: [
          {
            PolicyName: {
              'Fn::Join': [
                '-',
                [
                  service.service,
                  stage,
                  'warmer',
                  warmerName.toLowerCase(),
                  'policy',
                ],
              ],
            },
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                  ],
                  Resource: [{
                    'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/${warmerConfig.name}:*`,
                  }],
                },
                {
                  Effect: 'Allow',
                  Action: [
                    'logs:PutLogEvents',
                  ],
                  Resource: [{
                    'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/${warmerConfig.name}:*:*`,
                  }],
                },
                {
                  Effect: 'Allow',
                  Action: [
                    'lambda:InvokeFunction',
                  ],
                  Resource: functions.map((fn) => ({
                    'Fn::Sub': `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:${fn.name}`,
                  })),
                },
                {
                  Effect: 'Allow',
                  Action: [
                    'ec2:CreateNetworkInterface',
                    'ec2:DescribeNetworkInterfaces',
                    'ec2:DetachNetworkInterface',
                    'ec2:DeleteNetworkInterface',
                  ],
                  Resource: '*',
                },
              ],
            },
          },
        ],
      },
    };
  }

  /**
   * @description Create warm up function code and write it to the handler file
   * and add warm up function to the service
   * */
  async configureWarmer(warmerName, warmerConfig, functions) {
    if (functions === undefined || functions.length === 0) {
      this.serverless.cli.log(`WarmUp: Skipping warmer "${warmerName}" creation. No functions to warm up.`);
      return;
    }

    this.serverless.cli.log(`WarmUp: Creating warmer "${warmerName}" to warm up ${functions.length} function${functions.length === 1 ? '' : 's'}:`);
    functions.forEach((func) => this.serverless.cli.log(`          * ${func.name}`));

    const handlerFolder = path.join(this.serverless.config.servicePath, warmerConfig.folderName);

    await fs.mkdir(handlerFolder, { recursive: true });

    await WarmUp.createWarmUpFunctionArtifact(
      functions,
      this.provider.getRegion(),
      path.join(handlerFolder, 'index.js'),
    );

    if (warmerConfig.role === undefined) {
      WarmUp.addWarmUpFunctionRoleToResources(
        this.serverless.service,
        this.stage,
        warmerName,
        warmerConfig,
        functions,
      );
    }

    WarmUp.addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
  }

  async invokeWarmer(warmerName, warmerConfig, functions) {
    if (functions === undefined || functions.length === 0) {
      this.serverless.cli.log(`WarmUp: Skipping prewarming using warmer "${warmerName}". No functions to warm up.`);
      return;
    }

    this.serverless.cli.log(`WarmUp: Prewarming up you functions using warmer "${warmerName}".`);

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
      this.serverless.cli.log(`WarmUp: Warmer "${warmerName}" successfully prewarmed your functions.`);
    } catch (err) {
      this.serverless.cli.log(`WarmUp: Error while prewarming your functions using warmer "${warmerName}".`, err);
    }
  }
}

/** Export WarmUp class */
module.exports = WarmUp;
