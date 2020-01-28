function getServerlessConfig(serverless = {}) {
  return {
    getProvider: serverless.getProvider || (() => {}),
    config: {
      servicePath: (serverless.config && serverless.config.servicePath) ? serverless.config.servicePath : 'testPath',
    },
    cli: {
      log() {},
    },
    service: {
      provider: (serverless.service && serverless.service.provider)
        ? serverless.service.provider
        : { stage: '', region: '' },
      defaults: (serverless.service && serverless.service.defaults)
        ? serverless.service.defaults
        : { stage: '', region: '' },
      service: 'warmup-test',
      custom: serverless.service ? serverless.service.custom : undefined,
      getAllFunctions() { return Object.keys(this.functions); },
      getFunction(name) { return this.functions[name]; },
      functions: (serverless.service && serverless.service.functions)
        ? serverless.service.functions
        : {},
    },
  };
}

function getExpectedFunctionConfig(options = {}) {
  return {
    description: 'Serverless WarmUp Plugin',
    events: [{ schedule: 'rate(5 minutes)' }],
    handler: '_warmup/index.warmUp',
    memorySize: 128,
    name: 'warmup-test-dev-warmup-plugin',
    runtime: 'nodejs12.x',
    package: {
      individually: true,
      exclude: ['**'],
      include: ['_warmup/**'],
    },
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
    Qualifier: '$LATEST',
    Payload: '{"source":"serverless-plugin-warmup"}',
    ...options,
  };
}

module.exports = {
  getServerlessConfig,
  getExpectedFunctionConfig,
  getExpectedLambdaCallOptions,
};
