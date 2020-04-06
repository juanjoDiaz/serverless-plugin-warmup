/* global jest beforeEach describe it expect */

const path = require('path');

jest.mock('fs-extra');
const fs = require('fs-extra');
const WarmUp = require('../src/index');
const {
  getServerlessConfig,
  getExpectedFunctionConfig,
  getExpectedLambdaCallOptions,
} = require('./utils/configUtils');
const { GeneratedFunctionTester } = require('./utils/generatedFunctionTester');


fs.outputFile.mockReturnValue(Promise.resolve());

describe('Serverless warmup plugin constructor', () => {
  beforeEach(() => fs.outputFile.mockClear());

  it('Should work with only defaults and do nothing', async () => {
    const serverless = getServerlessConfig({
      service: {
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should do nothing if globally disabled using shorthand', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: false,
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled using shorthand', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: true,
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should warmup all functions if globally enabled using boolean as string', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: 'true',
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should warmup all functions if globally enabled for a stage using shorthand and stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: 'dev',
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should do nothing if globally enabled for stage using shorthand but stage does not match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: 'staging',
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled for a stage list using shorthand and a stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: ['dev', 'staging'],
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should do nothing if globally enabled for stage list using shorthand but no stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: ['staging', 'prod'],
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should do nothing if globally disabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: false,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should warmup all functions if globally enabled for a stage and stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'dev',
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should do nothing if globally enabled for stage but stage does not match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'staging',
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled for a stage list and a stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['dev', 'staging'],
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should do nothing if globally enabled for stage list but no stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['staging', 'prod'],
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined();
    expect(fs.outputFile).not.toHaveBeenCalled();
  });

  it('Should override globally enabled option with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: false } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'staging' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['staging', 'prod'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled option with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: false,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: true } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: false,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'dev' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: false,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['dev', 'staging'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally enabled for stage with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'dev',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: false } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'dev',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'staging' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'dev',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['staging', 'prod'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled for stage with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'staging',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: true } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'stage',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'dev' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'staging',
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['dev', 'staging'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally enabled for stage list with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['dev', 'staging'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: false } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['dev', 'staging'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'staging' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['dev', 'staging'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['staging', 'prod'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled for stage list with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['staging', 'prod'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: true } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['staging', 'prod'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: 'dev' } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['staging', 'prod'],
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: ['dev', 'staging'] } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.outputFile).toHaveBeenCalledTimes(1);
    expect(fs.outputFile.mock.calls[0][0]).toBe(path.join('testPath', '_warmup', 'index.js'));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should use the stage and region from defaults if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'staging',
          },
        },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        name: 'warmup-test-staging-warmup-plugin',
      }));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('eu-west-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should use the stage and region from provider if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: 'prod',
          },
        },
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        name: 'warmup-test-prod-warmup-plugin',
      }));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('eu-west-2');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should use the stage and region from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: ['test'],
          },
        },
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, { stage: 'test', region: 'us-west-2' });

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        name: 'warmup-test-test-warmup-plugin',
      }));

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-west-2');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should use the folder name from custom config', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            folderName: 'test-folder',
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        handler: 'test-folder/index.warmUp',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['test-folder/**'],
        },
      }));
  });

  it('Should use the service name from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            name: 'test-name',
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, { stage: 'test', region: 'us-west-2' });

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        name: 'test-name',
      }));
  });

  it('Should use the service roles from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            role: 'test-role',
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        role: 'test-role',
      }));
  });

  it('Should use the service tag from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            tags: {
              tag1: 'test-tag-1',
              tag2: 'test-tag-2',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        tags: {
          tag1: 'test-tag-1',
          tag2: 'test-tag-2',
        },
      }));
  });

  it('Should set the VPC to empty if set to false in options', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            vpc: false,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        vpc: { securityGroupIds: [], subnetIds: [] },
      }));
  });

  it('Should set the VPC to empty from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] },
      }));
  });

  it('Should use the service events from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            events: [{ schedule: 'rate(10 minutes)' }],
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        events: [{ schedule: 'rate(10 minutes)' }],
      }));
  });

  it('Should use the memory size from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            memorySize: 256,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        memorySize: 256,
      }));
  });

  it('Should use the timeout from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            timeout: 30,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        timeout: 30,
      }));
  });

  it('Should unset the environment variables from options as default', async () => {
    const serverless = getServerlessConfig({
      service: {
        provider: {
          environment: {
            test: 'value',
            other_var: 'other_value',
          },
        },
        custom: {
          warmup: {
            enabled: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        environment: {
          test: undefined,
          other_var: undefined,
        },
      }));
  });

  it('Should be able to unset environment variables from function options', async () => {
    const serverless = getServerlessConfig({
      service: {
        provider: {
          environment: {
            test: 'value',
            other_var: 'other_value',
          },
        },
        custom: {
          warmup: {
            enabled: true,
            environment: {
              test: 'new_value',
              other_var: undefined,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        environment: {
          test: 'new_value',
          other_var: undefined,
        },
      }));
  });

  it('Should use the environment from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            environment: {
              test: 'value',
              other_var: 'other_value',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig({
        environment: {
          test: 'value',
          other_var: 'other_value',
        },
      }));
  });

  it('Should use the client context from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            clientContext: { test: 'data' },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"test":"data"}}').toString('base64'),
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{"test":"data"}}').toString('base64'),
      }));
  });

  it('Should override client context from options if present at the function', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            clientContext: { test: 'data' },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { clientContext: { othersource: 'test' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"othersource":"test"}}').toString('base64'),
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{"test":"data"}}').toString('base64'),
      }));
  });

  it('Should not send the client context if set to false', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            clientContext: false,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: undefined,
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: undefined,
      }));
  });

  it('Should use the payload as client context if it\'s not set', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            payload: { test: 'data' },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"test":"data"}}').toString('base64'),
        Payload: '{"test":"data"}',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{"test":"data"}}').toString('base64'),
        Payload: '{"test":"data"}',
      }));
  });

  it('Should use the payload from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            payload: { test: 20 },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"test":20}}').toString('base64'),
        Payload: '{"test":20}',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{"test":20}}').toString('base64'),
        Payload: '{"test":20}',
      }));
  });

  it('Should override payload from options if present at the function', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            payload: { test: 20 },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { payload: { othersource: 'test' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"othersource":"test"}}').toString('base64'),
        Payload: '{"othersource":"test"}',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{"test":20}}').toString('base64'),
        Payload: '{"test":20}',
      }));
  });

  it('Should not stringify the payload if it is already a string', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            payload: '{test:20}',
            payloadRaw: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{test:20}}').toString('base64'),
        Payload: '{test:20}',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{test:20}}').toString('base64'),
        Payload: '{test:20}',
      }));
  });

  it('Should not stringify the payload at function level if it is already a string', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            payload: '{test:20}',
            payloadRaw: true,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { payload: { test: 'value' }, payloadRaw: false } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        ClientContext: Buffer.from('{"custom":{"test":"value"}}').toString('base64'),
        Payload: '{"test":"value"}',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        ClientContext: Buffer.from('{"custom":{test:20}}').toString('base64'),
        Payload: '{test:20}',
      }));
  });

  it('Should warmup the function using the concurrency from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            concurrency: 3,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(6);
    for (let i = 1; i <= 3; i += 1) {
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(i, getExpectedLambdaCallOptions('someFunc1'));
    }
    for (let i = 4; i <= 6; i += 1) {
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(i, getExpectedLambdaCallOptions('someFunc2'));
    }
  });

  it('Should override the concurrency from options if present at the function', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            concurrency: 3,
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { concurrency: 6 } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config.region).toBe('us-east-1');
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(9);
    for (let i = 1; i <= 6; i += 1) {
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(i, getExpectedLambdaCallOptions('someFunc1'));
    }
    for (let i = 7; i <= 9; i += 1) {
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(i, getExpectedLambdaCallOptions('someFunc2'));
    }
  });

  describe('Other plugins integrations', () => {
    it('Should use the warmup function alias if SERVERLESS_ALIAS env variable is present', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());

      const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
      functionTester.executeWarmupFunction({ env: { SERVERLESS_ALIAS: 'TEST_ALIAS' } });

      expect(functionTester.aws.config.region).toBe('us-east-1');
      expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
          Qualifier: 'TEST_ALIAS',
        }));
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
          Qualifier: 'TEST_ALIAS',
        }));
    });
  });

  describe('Backwards compatibility', () => {
    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: true,
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());
    });

    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: 'dev',
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());
    });

    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: ['dev', 'staging'],
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());
    });

    it('Should accept backwards compatible "schedule" property as string in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              schedule: 'rate(10 minutes)',
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig({
          events: [{ schedule: 'rate(10 minutes)' }],
        }));
    });

    it('Should accept backwards compatible "source" property in place of "payload"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              source: '{"test":20}',
            },
          },
          functions: {
            someFunc1: { name: 'someFunc1', warmup: { source: { otherpayload: 'test' } } },
            someFunc2: { name: 'someFunc2' },
          },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());

      const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
      functionTester.executeWarmupFunction();

      expect(functionTester.aws.config.region).toBe('us-east-1');
      expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
          ClientContext: Buffer.from('{"custom":{"otherpayload":"test"}}').toString('base64'),
          Payload: '{"otherpayload":"test"}',
        }));
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
          ClientContext: Buffer.from('{"custom":"{\\"test\\":20}"}').toString('base64'),
          Payload: '"{\\"test\\":20}"',
        }));
    });

    it('Should accept backwards compatible "sourceRaw" property in place of "payloadRaw"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              source: '{test:20}',
              sourceRaw: true,
            },
          },
          functions: {
            someFunc1: { name: 'someFunc1', warmup: { source: { test: 'value' }, sourceRaw: false } },
            someFunc2: { name: 'someFunc2' },
          },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig());

      const functionTester = new GeneratedFunctionTester(fs.outputFile.mock.calls[0][1]);
      functionTester.executeWarmupFunction();

      expect(functionTester.aws.config.region).toBe('us-east-1');
      expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
          ClientContext: Buffer.from('{"custom":{"test":"value"}}').toString('base64'),
          Payload: '{"test":"value"}',
        }));
      expect(functionTester.lambdaInstances[0])
        .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
          ClientContext: Buffer.from('{"custom":{test:20}}').toString('base64'),
          Payload: '{test:20}',
        }));
    });

    it('Should accept backwards compatible "schedule" property as array in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              schedule: ['rate(10 minutes)', 'rate(30 minutes)'],
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:package:initialize']();

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toEqual(getExpectedFunctionConfig({
          events: [{ schedule: 'rate(10 minutes)' }, { schedule: 'rate(30 minutes)' }],
        }));
    });
  });
});
