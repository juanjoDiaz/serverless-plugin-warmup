/* global jest describe it expect */

const WarmUp = require('../src/index');
const { getServerlessConfig } = require('./utils/configUtils');

describe('Serverless warmup plugin after:deploy:deploy hook', () => {
  it('Should prewarm the functions if prewarm is set to true and there are functions', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            prewarm: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:deploy:deploy']();

    expect(mockProvider.request).toHaveBeenCalledTimes(1);
    const params = {
      FunctionName: 'warmup-test-dev-warmup-plugin',
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: '$LATEST',
      Payload: '{"source":"serverless-plugin-warmup"}',
    };
    expect(mockProvider.request).toHaveBeenCalledWith('Lambda', 'invoke', params);
  });

  it('Should not prewarm the functions if prewarm is set to true and there are no functions', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            prewarm: true,
          },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:deploy:deploy']();

    expect(mockProvider.request).not.toHaveBeenCalled();
  });

  it('Should not prewarm the functions if prewarm is set to false', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            prewarm: false,
          },
        },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:deploy:deploy']();

    expect(mockProvider.request).not.toHaveBeenCalled();
  });

  it('Should not error if prewarming fails', async () => {
    const mockProvider = { request: jest.fn(() => Promise.reject(new Error())) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            prewarm: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:deploy:deploy']();

    expect(mockProvider.request).toHaveBeenCalledTimes(1);
    const params = {
      FunctionName: 'warmup-test-dev-warmup-plugin',
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: '$LATEST',
      Payload: '{"source":"serverless-plugin-warmup"}',
    };
    expect(mockProvider.request).toHaveBeenCalledWith('Lambda', 'invoke', params);
  });

  describe('Other plugins integrations', () => {
    it('Should use the warmup function alias if SERVERLESS_ALIAS env variable is present', async () => {
      const mockProvider = { request: jest.fn(() => Promise.resolve()) };
      const serverless = getServerlessConfig({
        getProvider() { return mockProvider; },
        service: {
          custom: {
            warmup: {
              enabled: true,
              prewarm: true,
              environment: {
                SERVERLESS_ALIAS: 'TEST_ALIAS',
              },
            },
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
        },
      });
      const plugin = new WarmUp(serverless, {});

      await plugin.hooks['after:deploy:deploy']();

      expect(mockProvider.request).toHaveBeenCalledTimes(1);
      const params = {
        FunctionName: 'warmup-test-dev-warmup-plugin',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Qualifier: 'TEST_ALIAS',
        Payload: '{"source":"serverless-plugin-warmup"}',
      };
      expect(mockProvider.request).toHaveBeenCalledWith('Lambda', 'invoke', params);
    });
  });
});
