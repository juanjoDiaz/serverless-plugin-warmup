/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'fs'
 * @requires 'path'
 * @requires 'child_process'
 * */
const fs = require('fs').promises;
const path = require('path');
const { extendServerlessSchema } = require('./schema');
const { getConfigsByWarmer } = require('./config');
const {
  addWarmUpFunctionRoleToResources,
  createWarmUpFunctionArtifact,
  addWarmUpFunctionToService,
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
   * @param {!Object} cliOptions - Serverless cliOptions
   * */
  constructor(serverless, cliOptions, { log }) {
    /** Serverless variables */
    this.serverless = serverless;
    this.cliOptions = cliOptions;
    this.log = log;

    this.provider = this.serverless.getProvider('aws');

    extendServerlessSchema(this.serverless);

    this.commands = {
      warmup: {
        commands: {
          addWarmers: { lifecycleEvents: ['addWarmers'] },
          cleanupTempDir: { lifecycleEvents: ['cleanup'] },
          prewarm: {
            lifecycleEvents: ['start', 'end'],
            cliOptions: {
              warmers: {
                shortcut: 'w',
                usage: 'Comma-separated list of warmer names to prewarm.',
                type: 'string',
              },
            },
            usage: 'Invoke a warmer to warm the functions on demand.',
          },
        },
      },
    };

    this.hooks = {
      'after:package:initialize': () => this.serverless.pluginManager.spawn('warmup:addWarmers'),
      'after:package:createDeploymentArtifacts': () => this.serverless.pluginManager.spawn('warmup:cleanupTempDir'),
      'after:deploy:deploy': () => this.serverless.pluginManager.spawn('warmup:prewarm'),
      'after:deploy:function:deploy': () => this.serverless.pluginManager.spawn('warmup:prewarm'),
      'before:warmup:addWarmers:addWarmers': this.configPlugin.bind(this),
      'warmup:addWarmers:addWarmers': this.initializeWarmers.bind(this),
      'before:warmup:cleanupTempDir:cleanup': this.configPlugin.bind(this),
      'warmup:cleanupTempDir:cleanup': this.cleanUp.bind(this),
      'before:warmup:prewarm:start': this.configPlugin.bind(this),
      'warmup:prewarm:start': this.prewarmFunctions.bind(this),
      // Workaround webpack/bundle plugins and serverless_sdk
      'before:package:createDeploymentArtifacts': this.resetWarmerConfigs.bind(this),
    };

    // Fixed for issues in Serverles
    // https://github.com/serverless/serverless/pull/9307
    this.serviceDir = this.serverless.serviceDir || this.serverless.config.servicePath || '';
  }

  /**
   * @description Configures the plugin if needed or do nothing if already configured.
   * */
  configPlugin() {
    this.stage = this.stage || this.provider.getStage();
    this.configsByWarmer = this.configsByWarmer
      || getConfigsByWarmer(this.serverless, this.stage);
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
   * @description Workaround webpack/bundle plugins and serverless_sdk.
   * Reset the plugin and ignore changes
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  async resetWarmerConfigs() {
    Object.entries(this.configsByWarmer)
      .forEach(([warmerName, warmerConfig]) => {
        if (warmerConfig.functions.length === 0) return;
        addWarmUpFunctionToService(this.serverless.service, warmerName, warmerConfig);
      });
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
        await fs.rm(
          path.join(this.serviceDir, folderToClean),
          { recursive: true },
        );
      } catch (err) {
        if (err.code !== 'ENOENT') {
          this.log.error(`WarmUp: Couldn't clean up temporary folder ${folderToClean}.`);
        }
      }
    }));

    try {
      const defaultDir = path.join(this.serviceDir, '.warmup');
      if (
        foldersToClean.some((folder) => folder.startsWith('.warmup'))
        && (await fs.readdir(defaultDir)).length === 0
      ) {
        await fs.rm(defaultDir, { recursive: true });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.log.error('WarmUp: Couldn\'t clean up temporary folder .warmup.');
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
    const warmerNames = (this.cliOptions.warmers)
      ? this.cliOptions.warmers.split(',')
      : Object.entries(this.configsByWarmer)
        .filter(([, warmerConfig]) => warmerConfig.prewarm)
        .map(([warmerName]) => warmerName);

    await Promise.all(warmerNames.map(async (warmerName) => {
      const warmerConfig = this.configsByWarmer[warmerName];
      if (!warmerConfig) {
        throw new this.serverless.classes.Error(`Warmer names ${warmerName} doesn't exist.`);
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
      this.log.warning(`WarmUp: Skipping warmer "${warmerName}" creation. No functions to warm up.`);
      return;
    }

    this.log.notice(`WarmUp: Creating warmer "${warmerName}" to warm up ${warmerConfig.functions.length} function${warmerConfig.functions.length === 1 ? '' : 's'}`);
    this.log.info(':');
    warmerConfig.functions.forEach((func) => this.log.info(`          * ${func.name}`));

    const handlerFolder = path.join(this.serviceDir, warmerConfig.folderName);

    await createWarmUpFunctionArtifact(
      warmerConfig.functions,
      warmerConfig.tracing,
      warmerConfig.verbose,
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
      this.log.warning(`WarmUp: Skipping prewarming using warmer "${warmerName}". No functions to warm up.`);
      return;
    }

    this.log.notice(`WarmUp: Prewarming up your functions using warmer "${warmerName}".`);

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
      this.log.notice(`WarmUp: Warmer "${warmerName}" successfully prewarmed your functions.`);
    } catch (err) {
      this.log.error(`WarmUp: Error while prewarming your functions using warmer "${warmerName}".`, err);
    }
  }
}

/** Export WarmUp class */
module.exports = WarmUp;
