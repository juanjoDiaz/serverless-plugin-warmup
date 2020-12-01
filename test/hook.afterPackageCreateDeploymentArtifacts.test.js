/* global jest beforeEach describe it expect */

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    writeFile: jest.fn(),
    rmdir: jest.fn(),
  },
}));
const fs = require('fs').promises;
const path = require('path');
const WarmUp = require('../src/index');
const { getServerlessConfig, getExpectedFunctionConfig } = require('./utils/configUtils');

const files = ['index.js'];

describe('Serverless warmup plugin after:package:createDeploymentArtifacts hook', () => {
  beforeEach(() => {
    fs.readdir.mockClear();
    fs.unlink.mockClear();
    fs.rmdir.mockClear();
  });

  it('Should clean the temporary folder if cleanFolder is set to true', async () => {
    fs.readdir.mockResolvedValueOnce(files);
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.unlink).toHaveBeenCalledTimes(files.length);
    files.forEach((file, i) => expect(fs.unlink).toHaveBeenNthCalledWith(i + 1, path.join('testPath', '_warmup', 'default', file)));
    expect(fs.rmdir).toHaveBeenCalledTimes(1);
    expect(fs.rmdir).toHaveBeenCalledWith(path.join('testPath', '_warmup', 'default'));
  });

  it('Should clean the custom temporary folder if cleanFolder is set to true', async () => {
    fs.readdir.mockResolvedValueOnce(files);
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.unlink).toHaveBeenCalledTimes(files.length);
    files.forEach((file, i) => expect(fs.unlink).toHaveBeenNthCalledWith(i + 1, path.join('testPath', 'test-folder', file)));
    expect(fs.rmdir).toHaveBeenCalledTimes(1);
    expect(fs.rmdir).toHaveBeenCalledWith(path.join('testPath', 'test-folder'));
  });

  it('Should ignore cleaning the custom temporary folder if there was nothing to clean', async () => {
    const err = new Error('Folder doesn\'t exist');
    err.code = 'ENOENT';
    fs.readdir.mockRejectedValueOnce(err);
    const mockProvider = { request: jest.fn(() => Promise.reject()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.rmdir).not.toHaveBeenCalled();
  });


  it('Should not error if couldn\'t clean up the custom temporary folder', async () => {
    fs.readdir.mockResolvedValueOnce(files);
    fs.rmdir.mockRejectedValueOnce(new Error('Folder couldn\'t be cleaned'));
    const mockProvider = { request: jest.fn(() => Promise.reject()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.rmdir).toHaveBeenCalledTimes(1);
    expect(fs.rmdir).toHaveBeenCalledWith(path.join('testPath', '_warmup', 'default'));
  });

  it('Should not clean the temporary folder if cleanFolder is set to false', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.rmdir).not.toHaveBeenCalled();
  });

  it('Should package only the lambda handler by default', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/default/**'],
        },
      }));
  });

  it('Should exclude files included at the service level', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        package: {
          include: ['../**'],
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          include: ['!../**', '_warmup/default/**'],
          exclude: ['**'],
        },
      }));
  });

  it('Should use the package exclusions from options if present', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              package: {
                individually: true,
                exclude: ['../**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          include: ['_warmup/default/**'],
          exclude: ['../**'],
        },
      }));
  });

  it('Should use the package inclusions from options if present', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              package: {
                individually: true,
                exclude: ['../**'],
                include: ['test/**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          exclude: ['../**'],
          include: ['test/**', '_warmup/default/**'],
        },
      }));
  });

  it('Should not duplicate the warmup folder inclusion even if manually included', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              package: {
                individually: true,
                exclude: ['../**'],
                include: ['test/**', '_warmup/default/**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          exclude: ['../**'],
          include: ['test/**', '_warmup/default/**'],
        },
      }));
  });

  it('Should use the package inclusions with custom folderName', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              folderName: 'test-folder',
              package: {
                individually: true,
                exclude: ['../**'],
                include: ['test/**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        handler: 'test-folder/index.warmUp',
        package: {
          individually: true,
          exclude: ['../**'],
          include: ['test/**', 'test-folder/**'],
        },
      }));
  });

  it('Should support package individually false', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              package: {
                individually: false,
                exclude: ['../**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        handler: '_warmup/default/index.warmUp',
        package: {
          individually: false,
          exclude: ['../**'],
          include: ['_warmup/default/**'],
        },
      }));
  });

  it('Should use default exclude if missing', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        handler: '_warmup/default/index.warmUp',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/default/**'],
        },
      }));
  });

  it('Should use default individually if missing', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            default: {
              enabled: true,
              package: {
                exclude: ['**'],
              },
            },
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:initialize']();

    expect(plugin.serverless.service.functions.warmUpPluginDefault)
      .toEqual(getExpectedFunctionConfig({
        handler: '_warmup/default/index.warmUp',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/default/**'],
        },
      }));
  });
});
