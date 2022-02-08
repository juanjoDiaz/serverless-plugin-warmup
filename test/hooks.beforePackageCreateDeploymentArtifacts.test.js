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
const WarmUp = require('../src/index');
const {
  getServerlessConfig,
  getPluginUtils,
  getExpectedFunctionConfig,
} = require('./utils/configUtils');

describe('Serverless warmup plugin warmup:warmers:addWarmers:addWarmers hook', () => {
  beforeEach(() => {
    fs.mkdir.mockClear();
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockClear();
    fs.writeFile.mockResolvedValue(undefined);
    exec.mockClear();
  });

  it('Should reset warmers before package:createDeploymentArtifacts', async () => {
    const mockedRequest = jest.fn(() => Promise.resolve());
    const serverless = getServerlessConfig({
      provider: { request: mockedRequest },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
            },
          },
        },
        functions: {
          someFunc1: { name: 'someFunc1' },
          someFunc2: { name: 'someFunc2' },
          warmUpPluginDefault: { name: 'invalidName', handler: 'invalidHandler' },
        },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['before:package:createDeploymentArtifacts']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({ role: undefined }));
  });

  it('Should not set warmers before package:createDeploymentArtifacts if there are no functions to warm', async () => {
    const mockedRequest = jest.fn(() => Promise.resolve());
    const serverless = getServerlessConfig({
      provider: { request: mockedRequest },
      service: {
        custom: {
          warmup: {
            default: {},
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils();
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:addWarmers:addWarmers']();
    await plugin.hooks['before:package:createDeploymentArtifacts']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault).toBeUndefined();
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});
