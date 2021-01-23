const path = require('path');

/**
 * @description Clean a global configuration object
 * and fill the missing options using the given defaults
 *
 * @return {Object} - Global configuration options
 * */
function getWarmerConfig(config, defaultOpts) {
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
    tracing: (config.tracing !== undefined) ? config.tracing : defaultOpts.tracing,
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
function getFunctionConfig(config, defaultOpts) {
  /* eslint-disable no-nested-ternary */
  return {
    enabled: (config.enabled !== undefined)
      ? config.enabled
      : defaultOpts.enabled,
    alias: (config.alias !== undefined)
      ? config.alias
      : defaultOpts.alias,
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
 * @description After package initialize hook. Create warmer function and add it to the service.
 *
 * @return {Array} - List of functions to be warmed up and their specific configs
 * */
function getFunctionsByWarmer(service, stage, configsByWarmer) {
  const functions = service.getAllFunctions()
    .map((name) => service.getFunction(name))
    .map((config) => {
      if (config.warmup === undefined) {
        return {
          name: config.name,
          config: Object.entries(configsByWarmer)
            .reduce((warmers, [warmerName, warmerConfig]) => ({
              ...warmers,
              [warmerName]: getFunctionConfig({}, warmerConfig),
            }), {}),
        };
      }

      const unknownWarmers = Object.keys(config.warmup)
        .filter((warmerName) => configsByWarmer[warmerName] === undefined);
      if (unknownWarmers.length > 0) {
        throw new Error(`WarmUp: Invalid function-level warmup configuration (${unknownWarmers.join(', ')}) in function ${config.name}. Every warmer should be declared in the custom section.`);
      }

      return {
        name: config.name,
        config: Object.entries(configsByWarmer)
          .reduce((warmers, [warmerName, warmerConfig]) => ({
            ...warmers,
            [warmerName]: getFunctionConfig(config.warmup[warmerName] || {}, warmerConfig),
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
 * @description Configure the plugin based on the context of serverless.yml
 *
 * @return {Object} - Configuration options to be used by the plugin
 * */
function getConfigsByWarmer(service, stage) {
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

  const configsByWarmer = Object.entries(service.custom ? service.custom.warmup : {})
    .reduce((warmers, [warmerName, warmerConfig]) => ({
      ...warmers,
      [warmerName]: {
        ...getWarmerConfig(warmerConfig, getWarmerDefaultOpts(warmerName)),
        ...getFunctionConfig(warmerConfig, functionDefaultOpts),
      },
    }), {});

  const functionsByWarmer = getFunctionsByWarmer(service, stage, configsByWarmer);

  return Object.entries(configsByWarmer).reduce((warmers, [warmerName, warmerConfig]) => ({
    ...warmers,
    [warmerName]: {
      ...warmerConfig,
      functions: functionsByWarmer[warmerName] || [],
    },
  }), {});
}

module.exports = {
  getConfigsByWarmer,
};
