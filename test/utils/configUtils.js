function getServerlessConfig (serverless = {}) {
  return {
    getProvider: serverless.getProvider || (() => {}),
    config: {
      servicePath: (serverless.config && serverless.config.servicePath) ? serverless.config.servicePath : 'testPath'
    },
    cli: {
      log() {}
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
      getAllFunctions() { return Object.keys(this.functions) },
      getFunction(name) { return this.functions[name] },
      functions: (serverless.service && serverless.service.functions) ? serverless.service.functions : {}
    }
  }
}

function getOptions (options = {}) {
  return options
}

module.exports = {
  getServerlessConfig,
  getOptions
}