/* global jest beforeEach describe it expect */

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    unlink: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
  },
}));
jest.mock('child_process', () => ({
  exec: jest.fn((path, opts, cb) => cb()),
}));
const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');
const WarmUp = require('../src/index');
const {
  getServerlessConfig,
  getPluginUtils,
  getExpectedLambdaClientConfig,
  getExpectedFunctionConfig,
  getExpectedLambdaCallOptions,
} = require('./utils/configUtils');
const { GeneratedFunctionTester } = require('./utils/generatedFunctionTester');

describe('Serverless warmup plugin warmup:warmers:addWarmers:addWarmers hook', () => {
  beforeEach(() => {
    fs.mkdir.mockClear();
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockClear();
    fs.writeFile.mockResolvedValue(undefined);
    exec.mockClear();
  });

  it('Should be called after package:initialize', async () => {
    const mockedRequest = jest.fn(() => Promise.resolve());
    const serverless = getServerlessConfig({
      provider: { request: mockedRequest },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              prewarm: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['after:package:initialize']();

    expect(serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
    expect(serverless.pluginManager.spawn).toHaveBeenCalledWith('warmup:addWarmers');
  });

  it('Should support multiple warmers', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
            secondary: {
              enabled: true,
            },
            tertiary: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1' },
          someFunc2: { name: 'someFunc2', warmup: { tertiary: { enabled: false } } },
          someFunc3: { name: 'someFunc3', warmup: { secondary: { enabled: false }, tertiary: { enabled: false } } },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(3);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.mkdir).toHaveBeenNthCalledWith(2, path.join('testPath', '.warmup', 'secondary'), { recursive: true });
    expect(fs.mkdir).toHaveBeenNthCalledWith(3, path.join('testPath', '.warmup', 'tertiary'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(3);
    expect(fs.writeFile).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());
    expect(fs.writeFile).toHaveBeenNthCalledWith(2, path.join('testPath', '.warmup', 'secondary', 'index.mjs'), expect.anything());
    expect(fs.writeFile).toHaveBeenNthCalledWith(3, path.join('testPath', '.warmup', 'tertiary', 'index.mjs'), expect.anything());

    const function1Tester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    function1Tester.executeWarmupFunction();

    expect(function1Tester.aws.config.region).toBe('us-east-1');
    expect(function1Tester.lambdaInstances[0]).toHaveBeenCalledTimes(3);
    expect(function1Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(function1Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));
    expect(function1Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(3, getExpectedLambdaCallOptions('someFunc3'));

    const function2Tester = new GeneratedFunctionTester(fs.writeFile.mock.calls[1][1]);
    function2Tester.executeWarmupFunction();

    expect(function2Tester.aws.config.region).toBe('us-east-1');
    expect(function2Tester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(function2Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(function2Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2'));

    const function3Tester = new GeneratedFunctionTester(fs.writeFile.mock.calls[2][1]);
    function3Tester.executeWarmupFunction();

    expect(function3Tester.aws.config.region).toBe('us-east-1');
    expect(function3Tester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(function3Tester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should error if unknown warmers are used in a function', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1', warmup: { unknown: { enabled: true } } }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    try {
      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();
    } catch (err) {
      expect(err.message).toEqual('WarmUp: Invalid function-level warmup configuration (unknown) in function someFunc1. Every warmer should be declared in the custom section.');
      expect(fs.mkdir).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    }
  });

  it('Should do nothing if globally enabled but no functions are enabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
            secondary: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { secondary: { enabled: false } } },
          someFunc2: { name: 'someFunc2', warmup: { secondary: { enabled: false } } },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginSecondary).toBeUndefined();
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());
  });

  it('Should work with only defaults and do nothing', async () => {
    const serverless = getServerlessConfig({
      service: {
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('Should do nothing if globally enabled for stage list using shorthand but no stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: ['staging', 'prod'],
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('Should do nothing if globally disabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: 'dev',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: 'staging',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('Should warmup all functions if globally enabled for a stage list and a stage match', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['dev', 'staging'],
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: ['staging', 'prod'],
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('Should override globally enabled option with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: false } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'staging' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['staging', 'prod'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled option with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: false,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: true } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: false,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'dev' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled option with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: false,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['dev', 'staging'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally enabled for stage with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'dev',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: false } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'dev',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'staging' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'dev',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['staging', 'prod'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled for stage with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'staging',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: true } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'stage',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'dev' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: 'staging',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['dev', 'staging'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally enabled for stage list with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['dev', 'staging'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: false } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['dev', 'staging'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'staging' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['dev', 'staging'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['staging', 'prod'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc2'));
  });

  it('Should override globally not enabled for stage list with local enablement', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['staging', 'prod'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: true } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['staging', 'prod'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: 'dev' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should override globally not enabled for stage list with local enablement for stage', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: ['staging', 'prod'],
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { enabled: ['dev', 'staging'] } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
    expect(fs.mkdir).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
  });

  it('Should use the folder name from custom config', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              folderName: 'test-folder',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        handler: 'test-folder/index.warmUp',
        package: {
          individually: true,
          patterns: ['!**', path.join('test-folder', '**')],
        },
      }));
  });

  it('Should use the service name from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              name: 'test-name',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, { stage: 'test', region: 'us-west-2' }, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        name: 'test-name',
      }));
  });

  it('Should use the roleName from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              roleName: 'test-roleName',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        roleName: 'test-roleName',
      }));
  });

  it('Should use the service roles from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              role: 'test-role',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        role: 'test-role',
      }));
  });

  it('Should use the service tag from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              tags: {
                tag1: 'test-tag-1',
                tag2: 'test-tag-2',
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
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
            default: {
              enabled: true,
              vpc: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        vpc: { securityGroupIds: [], subnetIds: [] },
      }));
  });

  it('Should set the VPC to empty from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] },
      }));
  });

  it('Should use the service events from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              events: [{ schedule: 'rate(10 minutes)' }],
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        events: [{ schedule: 'rate(10 minutes)' }],
      }));
  });

  it('Should use the architecture options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              architecture: 'x86_64',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({ architecture: 'x86_64' }));
  });

  it('Should override provider architecture setting if set up at the warmer config', async () => {
    const serverless = getServerlessConfig({
      service: {
        provider: {
          architecture: 'x86_64',
        },
        custom: {
          warmup: {
            default: {
              enabled: true,
              architecture: 'arm64',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({ architecture: 'arm64' }));
    expect(exec).not.toHaveBeenCalled();
  });

  it('Should use the memory size from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              memorySize: 256,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        memorySize: 256,
      }));
  });

  it('Should use the timeout from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              timeout: 30,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
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
            default: {
              enabled: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
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
            default: {
              enabled: true,
              environment: {
                test: 'new_value',
                other_var: undefined,
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
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
            default: {
              enabled: true,
              environment: {
                test: 'value',
                other_var: 'other_value',
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        environment: {
          test: 'value',
          other_var: 'other_value',
        },
      }));
  });

  it('Should enable X-Ray tracing if set up at the provider', async () => {
    const serverless = getServerlessConfig({
      service: {
        provider: {
          tracing: {
            lambda: true,
          },
        },
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());
  });

  it('Should enable X-Ray tracing if set up at the warmer config', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              tracing: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({ tracing: true }));
    expect(exec).toHaveBeenCalledTimes(2);
    expect(exec).toHaveBeenNthCalledWith(1, 'npm init -y', { cwd: path.join('testPath', '.warmup', 'default') }, expect.anything());
    expect(exec).toHaveBeenNthCalledWith(2, 'npm install --save aws-xray-sdk-core', { cwd: path.join('testPath', '.warmup', 'default') }, expect.anything());
  });

  it('Should overide provider tracing setting if set up at the warmer config', async () => {
    const serverless = getServerlessConfig({
      service: {
        provider: {
          tracing: {
            lambda: true,
          },
        },
        custom: {
          warmup: {
            default: {
              enabled: true,
              tracing: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({ tracing: false }));
    expect(exec).not.toHaveBeenCalled();
  });

  it('Should respect verbose from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              verbose: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    const fakeConsole = { log: jest.fn(), error: jest.fn() };
    functionTester.executeWarmupFunction({ console: fakeConsole });

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(1);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1'));
    expect(fakeConsole.log).not.toHaveBeenCalled();
  });

  it('Should use the logRetentionInDays from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              logRetentionInDays: 14,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        logRetentionInDays: 14,
      }));
  });

  it('Should use the function alias from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              alias: 'alias1',
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        Qualifier: 'alias1',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        Qualifier: 'alias1',
      }));
  });

  it('Should override function alias from options if present at the function', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              alias: 'alias1',
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { alias: 'alias2' } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
    expect(functionTester.lambdaInstances[0]).toHaveBeenCalledTimes(2);
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(1, getExpectedLambdaCallOptions('someFunc1', {
        Qualifier: 'alias2',
      }));
    expect(functionTester.lambdaInstances[0])
      .toHaveBeenNthCalledWith(2, getExpectedLambdaCallOptions('someFunc2', {
        Qualifier: 'alias1',
      }));
  });

  it('Should use the client context from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              clientContext: { test: 'data' },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              clientContext: { test: 'data' },
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { clientContext: { othersource: 'test' } } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              clientContext: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              payload: { test: 'data' },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              payload: { test: 20 },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              payload: { test: 20 },
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { payload: { othersource: 'test' } } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              payload: '{test:20}',
              payloadRaw: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              payload: '{test:20}',
              payloadRaw: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { payload: { test: 'value' }, payloadRaw: false } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              concurrency: 3,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
            default: {
              enabled: true,
              concurrency: 3,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { default: { concurrency: 6 } } },
          someFunc2: { name: 'someFunc2' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig());

    const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
    functionTester.executeWarmupFunction();

    expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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

  it('Should not error if the warmup configuration is missing', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {},
        functions: {},
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['warmup:addWarmers:addWarmers']();
  });

  describe('Packaging', () => {
    it('Should package only the lambda handler by default', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should package only the lambda handler by  if empty package option', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                package: {},
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should use the package patterns from options if present', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                package: {
                  individually: true,
                  patterns: [`!${path.join('..', '**')}`, path.join('test', '**')],
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', `!${path.join('..', '**')}`, path.join('test', '**'), path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should not duplicate the warmup folder inclusion even if manually included', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                package: {
                  individually: true,
                  patterns: [`!${path.join('..', '**')}`, path.join('test', '**'), path.join('.warmup', 'default', '**')],
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', `!${path.join('..', '**')}`, path.join('test', '**'), path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should use the package inclusions with custom folderName', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                folderName: 'test-folder',
                package: {
                  individually: true,
                  patterns: [`!${path.join('..', '**')}`, path.join('test', '**')],
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          handler: 'test-folder/index.warmUp',
          package: {
            individually: true,
            patterns: ['!**', `!${path.join('..', '**')}`, path.join('test', '**'), path.join('test-folder', '**')],
          },
        }));
    });

    it('Should support package individually false', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                package: {
                  individually: false,
                  patterns: [`!${path.join('..', '**')}`],
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: false,
            patterns: ['!**', `!${path.join('..', '**')}`, path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should use default pattern exclusion if missing', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                package: {
                  individually: true,
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', path.join('.warmup', 'default', '**')],
          },
        }));
    });

    it('Should use default individually if missing', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig({
          package: {
            individually: true,
            patterns: ['!**', path.join('.warmup', 'default', '**')],
          },
        }));
    });
  });

  describe('Other plugins integrations', () => {
    it('Should use the warmup function alias if SERVERLESS_ALIAS env variable is present', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig());

      const functionTester = new GeneratedFunctionTester(fs.writeFile.mock.calls[0][1]);
      functionTester.executeWarmupFunction({ process: { env: { SERVERLESS_ALIAS: 'TEST_ALIAS' } } });

      expect(functionTester.aws.config).toMatchObject(getExpectedLambdaClientConfig());
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
});
