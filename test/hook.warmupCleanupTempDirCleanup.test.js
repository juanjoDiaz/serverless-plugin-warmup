/* global jest beforeEach describe it expect */

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn((file) => ((!file.endsWith('node_modules') && !file.endsWith('.warmup')) ? ['index.mjs', 'node_modules'] : [])),
    writeFile: jest.fn(),
    rm: jest.fn(),
    stat: jest.fn((file) => ({ isDirectory: () => !file.endsWith('.js') })),
  },
}));
const fs = require('fs').promises;
const path = require('path');
const WarmUp = require('../src/index');
const { getServerlessConfig, getPluginUtils } = require('./utils/configUtils');

describe('Serverless warmup plugin warmup:cleanupTempDir:cleanup hook', () => {
  beforeEach(() => {
    fs.readdir.mockClear();
    fs.rm.mockClear();
  });

  it('Should be called after package:createDeploymentArtifacts', async () => {
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

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(serverless.pluginManager.spawn).toHaveBeenCalledTimes(1);
    expect(serverless.pluginManager.spawn).toHaveBeenCalledWith('warmup:cleanupTempDir');
  });

  it('Should clean the temporary folder if cleanFolder is set to true', async () => {
    fs.readdir.mockResolvedValueOnce([]);
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              cleanFolder: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils({
      log: {
        error: jest.fn(),
      },
    });
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.rm).toHaveBeenNthCalledWith(2, path.join('testPath', '.warmup'), { recursive: true });
    expect(pluginUtils.log.error).not.toHaveBeenCalledWith(expect.stringMatching(/^WarmUp: Couldn't clean up temporary folder .*/));
  });

  it('Should clean the custom temporary folder if cleanFolder is set to true', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              folderName: 'test-folder',
              cleanFolder: true,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils({
      log: {
        error: jest.fn(),
      },
    });
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.join('testPath', 'test-folder'), { recursive: true });
    expect(pluginUtils.log.error).not.toHaveBeenCalledWith(expect.stringMatching(/^WarmUp: Couldn't clean up temporary folder .*/));
  });

  it('Should not error if couldn\'t clean up the custom temporary folder', async () => {
    fs.rm.mockRejectedValueOnce(new Error('Folder couldn\'t be cleaned'));
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

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.rm).toHaveBeenCalledWith(path.join('testPath', '.warmup'), { recursive: true });
  });

  it('Should ignore cleaning the warmer temporary folders if there was nothing to clean', async () => {
    const err = new Error('Folder doesn\'t exist');
    err.code = 'ENOENT';
    fs.rm.mockRejectedValue(err);
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
    const pluginUtils = getPluginUtils({
      log: {
        error: jest.fn(),
      },
    });
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenNthCalledWith(1, path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(fs.rm).toHaveBeenNthCalledWith(2, path.join('testPath', '.warmup'), { recursive: true });
    expect(plugin.log.error).not.toHaveBeenCalledWith(expect.stringMatching(/^Middleware: Couldn't clean up temporary folder .*/));
  });

  it('Should not error if couldn\'t clean up the .warmup temporary folder', async () => {
    fs.readdir.mockImplementation((dir) => (dir === path.join('testPath', '.warmup') ? Promise.reject(new Error('Folder couldn\'t be cleaned')) : Promise.resolve([])));
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
    const pluginUtils = getPluginUtils({
      log: {
        error: jest.fn(),
      },
    });
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith(path.join('testPath', '.warmup', 'default'), { recursive: true });
    expect(pluginUtils.log.error).toHaveBeenCalledWith(expect.stringMatching(/^WarmUp: Couldn't clean up temporary folder .*/));
  });

  it('Should not clean the temporary folder if cleanFolder is set to false', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              cleanFolder: false,
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const pluginUtils = getPluginUtils({
      log: {
        error: jest.fn(),
      },
    });
    const plugin = new WarmUp(serverless, {}, pluginUtils);

    await plugin.hooks['before:warmup:cleanupTempDir:cleanup']();
    await plugin.hooks['warmup:cleanupTempDir:cleanup']();

    expect(fs.rm).not.toHaveBeenCalled();
    expect(pluginUtils.log.error).not.toHaveBeenCalledWith(expect.stringMatching(/^WarmUp: Couldn't clean up temporary folder .*/));
  });
});
