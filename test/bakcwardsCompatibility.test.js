/* global jest beforeEach describe it expect */

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    unlink: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
  },
}));

const fs = require('fs').promises;
const path = require('path');
const WarmUp = require('../src/index');
const { getServerlessConfig, getPluginUtils, getExpectedFunctionConfig } = require('./utils/configUtils');

describe('Backward compatibility', () => {
  describe('configSchemaHandler', () => {
    it('should not set the schema if configSchemaHandler is undefined', async () => {
      const serverless = getServerlessConfig({
        configSchemaHandler: null,
      });
      const pluginUtils = getPluginUtils();

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {}, pluginUtils);
    });

    it('should not define custom properties if defineCustomProperties is undefined', async () => {
      const defineCustomProperties = null;
      const defineFunctionProperties = jest.fn(() => {});
      const serverless = getServerlessConfig({
        configSchemaHandler: {
          defineCustomProperties,
          defineFunctionProperties,
        },
      });
      const pluginUtils = getPluginUtils();

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {}, pluginUtils);

      expect(defineFunctionProperties).toHaveBeenCalledTimes(1);
    });

    it('should not define function properties if defineFunctionProperties is undefined', async () => {
      const defineCustomProperties = jest.fn(() => {});
      const defineFunctionProperties = null;
      const serverless = getServerlessConfig({
        configSchemaHandler: {
          defineCustomProperties,
          defineFunctionProperties,
        },
      });
      const pluginUtils = getPluginUtils();

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {}, pluginUtils);

      expect(defineCustomProperties).toHaveBeenCalledTimes(1);
    });
  });

  describe('servicePath renamed to serviceDir', () => {
    beforeEach(() => {
      fs.mkdir.mockClear();
      fs.mkdir.mockResolvedValue(undefined);
      fs.writeFile.mockClear();
      fs.writeFile.mockResolvedValue(undefined);
    });

    it('should fallback to servicePath if serviceDir is not defined', async () => {
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
        serviceDir: null,
        config: {
          servicePath: 'testPath',
        },
      });

      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig());

      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.mkdir).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default'), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default', 'index.mjs'), expect.anything());
    });

    it('should fallback to \'\' if serviceDir and servicePath are not defined', async () => {
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
        serviceDir: null,
      });

      const pluginUtils = getPluginUtils();
      const plugin = new WarmUp(serverless, {}, pluginUtils);

      await plugin.hooks['before:warmup:addWarmers:addWarmers']();
      await plugin.hooks['warmup:addWarmers:addWarmers']();

      expect(plugin.serverless.service.functions.warmUpPluginDefault)
        .toEqual(getExpectedFunctionConfig());

      expect(fs.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.mkdir).toHaveBeenCalledWith(path.join('', '.warmup', 'default'), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(path.join('', '.warmup', 'default', 'index.mjs'), expect.anything());
    });
  });
});
