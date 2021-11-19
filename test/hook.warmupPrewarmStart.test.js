/* global jest describe it expect */

const WarmUp = require('../src/index');
const { getServerlessConfig, getPluginUtils } = require('./utils/configUtils');

describe('Serverless warmup plugin warmup:prewarm:start hook', () => {
  it('Should be called after deploy:deploy', async () => {
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

    await plugin.hooks['after:deploy:deploy']();

    expect(serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
    expect(serverless.pluginManager.spawn).toHaveBeenCalledWith('warmup:prewarm');
  });

  it('Should be called after deploy:function:deploy', async () => {
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

    await plugin.hooks['after:deploy:function:deploy']();

    expect(serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
    expect(serverless.pluginManager.spawn).toHaveBeenCalledWith('warmup:prewarm');
  });

  it('Should prewarm the functions if prewarm is set to true and there are functions', async () => {
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

    await plugin.hooks['before:warmup:prewarm:start']();
    await plugin.hooks['warmup:prewarm:start']();

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    const params = {
      FunctionName: 'warmup-test-dev-warmup-plugin-default',
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: undefined,
      Payload: '{"source":"serverless-plugin-warmup"}',
    };
    expect(mockedRequest).toHaveBeenCalledWith('Lambda', 'invoke', params);
  });

  it('Should not prewarm the functions if prewarm is set to true and there are no functions', async () => {
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
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:prewarm:start']();
    await plugin.hooks['warmup:prewarm:start']();

    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('Should not prewarm the functions if prewarm is set to true and there are no functions for specific warmer', async () => {
    const mockedRequest = jest.fn(() => Promise.resolve());
    const serverless = getServerlessConfig({
      provider: { request: mockedRequest },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
            secondary: {
              prewarm: true,
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

    await plugin.hooks['before:warmup:prewarm:start']();
    await plugin.hooks['warmup:prewarm:start']();

    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('Should not prewarm the functions if prewarm is set to false', async () => {
    const mockedRequest = jest.fn(() => Promise.resolve());
    const serverless = getServerlessConfig({
      provider: { request: mockedRequest },
      service: {
        custom: {
          warmup: {
            default: {
              prewarm: false,
            },
          },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:prewarm:start']();
    await plugin.hooks['warmup:prewarm:start']();

    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it('Should error if prewarming non-existing function', async () => {
    const mockedRequest = jest.fn(() => Promise.reject(new Error()));
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
    const plugin = new WarmUp(serverless, { warmers: 'default,non-existing' }, pluginUtils);

    await plugin.hooks['before:warmup:prewarm:start']();

    try {
      await plugin.hooks['warmup:prewarm:start']();
    } catch (err) {
      expect(err.message).toEqual('Warmer names non-existing doesn\'t exist.');
      expect(mockedRequest).toHaveBeenCalledTimes(1);
      const params = {
        FunctionName: 'warmup-test-dev-warmup-plugin-default',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Qualifier: undefined,
        Payload: '{"source":"serverless-plugin-warmup"}',
      };
      expect(mockedRequest).toHaveBeenCalledWith('Lambda', 'invoke', params);
    }
  });

  it('Should not error if prewarming fails', async () => {
    const mockedRequest = jest.fn(() => Promise.reject(new Error()));
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

    await plugin.hooks['before:warmup:prewarm:start']();
    await plugin.hooks['warmup:prewarm:start']();

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    const params = {
      FunctionName: 'warmup-test-dev-warmup-plugin-default',
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: undefined,
      Payload: '{"source":"serverless-plugin-warmup"}',
    };
    expect(mockedRequest).toHaveBeenCalledWith('Lambda', 'invoke', params);
  });

  describe('Other plugins integrations', () => {
    it('Should use the warmup function alias if SERVERLESS_ALIAS env variable is present', async () => {
      const mockedRequest = jest.fn(() => Promise.resolve());
      const serverless = getServerlessConfig({
        provider: { request: mockedRequest },
        service: {
          custom: {
            warmup: {
              default: {
                enabled: true,
                prewarm: true,
                environment: {
                  SERVERLESS_ALIAS: 'TEST_ALIAS',
                },
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:prewarm:start']();
      await plugin.hooks['warmup:prewarm:start']();

      expect(mockedRequest).toHaveBeenCalledTimes(1);
      const params = {
        FunctionName: 'warmup-test-dev-warmup-plugin-default',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Qualifier: 'TEST_ALIAS',
        Payload: '{"source":"serverless-plugin-warmup"}',
      };
      expect(mockedRequest).toHaveBeenCalledWith('Lambda', 'invoke', params);
    });
  });
});
