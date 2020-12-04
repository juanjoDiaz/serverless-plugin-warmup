/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'fs'
 * @requires 'path'
 * @requires 'child_process'
 * */
const path = require('path');
const { extendServerlessSchema } = require('./schema');
const { getConfigsByWarmer } = require('./config');
const {
  addWarmUpFunctionRoleToResources,
  createWarmUpFunctionArtifact,
  addWarmUpFunctionToService,
  cleanFolder,
} = require('./warmer');
const { capitalize } = require('./utils');

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

    extendServerlessSchema(this.serverless);

    this.commands = {
      warmup: {
        commands: {
          addWamers: { lifecycleEvents: ['addWamers'] },
          cleanupTempDir: { lifecycleEvents: ['cleanup'] },
          prewarm: {
            lifecycleEvents: ['start', 'end'],
            options: {
              warmers: {
                shortcut: 'w',
                usage: 'Comma-separated list of warmer names to prewarm.',
              },
            },
            usage: 'Invoke a warmer to warm the functions on demand.',
          },
        },
      },
    };

    this.hooks = {
      'after:package:initialize': () => this.serverless.pluginManager.spawn('warmup:addWamers'),
      'after:package:createDeploymentArtifacts': () => this.serverless.pluginManager.spawn('warmup:cleanupTempDir'),
      'after:deploy:deploy': () => this.serverless.pluginManager.spawn('warmup:prewarm'),
      'before:warmup:addWamers:addWamers': this.configPlugin.bind(this),
      'warmup:addWamers:addWamers': this.initializeWarmers.bind(this),
      'before:warmup:cleanupTempDir:cleanup': this.configPlugin.bind(this),
      'warmup:cleanupTempDir:cleanup': this.cleanUp.bind(this),
      'before:warmup:prewarm:start': this.configPlugin.bind(this),
      'warmup:prewarm:start': this.prewarmFunctions.bind(this),
    };
  }

  /**
   * @description Configures the plugin if needed or do nothing if already configured.
   * */
  configPlugin() {
    this.stage = this.stage || this.provider.getStage();
    this.configsByWarmer = this.configsByWarmer
      || getConfigsByWarmer(this.serverless.service, this.stage);
  }

  /**
   * @description Warm up initialize hook. Create warmer function and add it to the service.
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  async initializeWarmers() {
    await Promise.all(Object.entries(this.configsByWarmer)
      .map(([warmerName, warmerConfig]) => this.configureWarmer(warmerName, warmerConfig)));
  }

  /**
   * @description Warmup cleanup hook.
   *
   * @fulfil {} — Temp folders cleaned up
   * @reject {Error} Couldn't cleaned up temp folders
   *
   * @return {Promise}
   * */
  async cleanUp() {
    const foldersToClean = Array.from(new Set(Object.values(this.configsByWarmer)
      .filter((config) => config.cleanFolder)
      .map((config) => config.folderName)));

    await Promise.all(foldersToClean.map(async (folderToClean) => {
      try {
        await cleanFolder(path.join(this.serverless.config.servicePath, folderToClean));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.serverless.cli.log(`WarmUp: Couldn't clean up temporary folder ${folderToClean}.`);
        }
      }
    }));

    if (foldersToClean.some((folder) => folder.startsWith('.warmup'))) {
      try {
        await cleanFolder(path.join(this.serverless.config.servicePath, '.warmup'));
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.serverless.cli.log('WarmUp: Couldn\'t clean up temporary folder .warmup.');
        }
      }
    }
  }

  /**
   * @description Warmer prewarm functions hook
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  async prewarmFunctions() {
    const warmerNames = (this.options.warmers)
      ? this.options.warmers.split(',')
      : Object.entries(this.configsByWarmer)
        .filter(([, warmerConfig]) => warmerConfig.prewarm)
        .map(([warmerName]) => warmerName);

    await Promise.all(warmerNames.map(async (warmerName) => {
      const warmerConfig = this.configsByWarmer[warmerName];
      if (!warmerConfig) {
        throw new Error(`Warmer names ${warmerName} doesn't exist.`);
      }
      addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
      await this.invokeWarmer(warmerName, warmerConfig);
    }));
  }

  /**
   * @description Create warm up function code and write it to the handler file
   * and add warm up function to the service
   * */
  async configureWarmer(warmerName, warmerConfig) {
    if (warmerConfig.functions.length === 0) {
      this.serverless.cli.log(`WarmUp: Skipping warmer "${warmerName}" creation. No functions to warm up.`);
      return;
    }

    this.serverless.cli.log(`WarmUp: Creating warmer "${warmerName}" to warm up ${warmerConfig.functions.length} function${warmerConfig.functions.length === 1 ? '' : 's'}:`);
    warmerConfig.functions.forEach((func) => this.serverless.cli.log(`          * ${func.name}`));

    const handlerFolder = path.join(this.serverless.config.servicePath, warmerConfig.folderName);

    await createWarmUpFunctionArtifact(
      warmerConfig.functions,
      warmerConfig.tracing,
      this.provider.getRegion(),
      handlerFolder,
    );

    if (warmerConfig.role === undefined) {
      addWarmUpFunctionRoleToResources(
        this.serverless.service,
        this.stage,
        warmerName,
        warmerConfig,
      );
    }

    addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
  }

  async invokeWarmer(warmerName, warmerConfig) {
    if (warmerConfig.functions.length === 0) {
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
