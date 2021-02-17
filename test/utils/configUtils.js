/* global jest */

const path = require('path');

function getServerlessConfig(serverlessOverrides = {}) {
  const serverless = {
    provider: {},
    config: {},
    service: {},
    ...serverlessOverrides,
  };

  return {
    getProvider: serverless.getProvider || (() => ({
      request: serverless.provider.request || (() => Promise.resolve()),
      getStage: serverless.provider.getStage || (() => 'dev'),
      getRegion: serverless.provider.getRegion || (() => 'us-east-1'),
    })),
    pluginManager: {
      spawn: jest.fn(),
    },
    configSchemaHandler: serverless.configSchemaHandler !== undefined
      ? serverless.configSchemaHandler
      : {
        defineCustomProperties() {},
        defineFunctionProperties() {},
      },
    config: {
      servicePath: (serverless.config.servicePath) ? serverless.config.servicePath : 'testPath',
    },
    cli: {
      log: (serverless.config.cli && serverless.config.cli.log) || (() => {}),
    },
    service: {
      provider: serverless.service.provider || { stage: '', region: '' },
      defaults: serverless.service.defaults || { stage: '', region: '' },
      service: 'warmup-test',
      package: serverless.service.package,
      custom: serverless.service ? serverless.service.custom : undefined,
      getAllFunctions() { return Object.keys(this.functions); },
      getFunction(name) { return this.functions[name]; },
      functions: serverless.service.functions
        ? serverless.service.functions
        : {},
    },
  };
}

function getExpectedLambdaClientConfig(options = {}) {
  return {
    apiVersion: '2015-03-31',
    region: 'us-east-1',
    httpOptions: {
      connectTimeout: 1000,
    },
    ...options,
  };
}

function getExpectedFunctionConfig(options = {}) {
  const warmerName = options.warmerName || 'default';

  return {
    description: `Serverless WarmUp Plugin (warmer "${warmerName}")`,
    events: [{ schedule: 'rate(5 minutes)' }],
    handler: path.join('.warmup', warmerName, 'index.warmUp'),
    memorySize: 128,
    name: `warmup-test-dev-warmup-plugin-${warmerName}`,
    runtime: 'nodejs14.x',
    package: {
      individually: true,
      exclude: ['**'],
      include: [path.join('.warmup', warmerName, '**')],
    },
    role: 'WarmUpPluginDefaultRole',
    timeout: 10,
    ...options,
  };
}

function getExpectedLambdaCallOptions(funcName, options = {}) {
  return {
    ClientContext: Buffer.from('{"custom":{"source":"serverless-plugin-warmup"}}').toString('base64'),
    FunctionName: funcName,
    InvocationType: 'RequestResponse',
    LogType: 'None',
    Payload: '{"source":"serverless-plugin-warmup"}',
    ...options,
  };
}

module.exports = {
  getServerlessConfig,
  getExpectedLambdaClientConfig,
  getExpectedFunctionConfig,
  getExpectedLambdaCallOptions,
};
