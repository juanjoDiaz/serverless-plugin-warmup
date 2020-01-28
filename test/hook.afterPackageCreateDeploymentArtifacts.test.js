/* global jest beforeEach describe it expect */

const path = require('path');

jest.mock('fs-extra');
const fs = require('fs-extra');
const WarmUp = require('../src/index');
const { getServerlessConfig, getExpectedFunctionConfig } = require('./utils/configUtils');

describe('Serverless warmup plugin after:deploy:deploy hook', () => {
  beforeEach(() => fs.remove.mockClear());

  it('Should clean the temporary folder if cleanFolder is set to true', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            cleanFolder: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.remove).toHaveBeenCalledTimes(1);
    expect(fs.remove).toHaveBeenCalledWith(path.join('testPath', '_warmup'));
  });

  it('Should clean the custom temporary folder if cleanFolder is set to true', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            folderName: 'test-folder',
            cleanFolder: true,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.remove).toHaveBeenCalledTimes(1);
    expect(fs.remove).toHaveBeenCalledWith(path.join('testPath', 'test-folder'));
  });

  it('Should not clean the temporary folder if cleanFolder is set to false', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
      service: {
        custom: {
          warmup: {
            enabled: true,
            cleanFolder: false,
          },
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } },
      },
    });
    const plugin = new WarmUp(serverless, {});

    await plugin.hooks['after:package:createDeploymentArtifacts']();

    expect(fs.remove).not.toHaveBeenCalled();
  });

  it('Should package only the lambda handler by default', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) };
    const serverless = getServerlessConfig({
      getProvider() { return mockProvider; },
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
      .toEqual(getExpectedFunctionConfig({
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**'],
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
            enabled: true,
            package: {
              individually: true,
              exclude: ['../**'],
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
        package: {
          individually: true,
          include: ['_warmup/**'],
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
            enabled: true,
            package: {
              individually: true,
              exclude: ['../**'],
              include: ['test/**'],
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
        package: {
          individually: true,
          exclude: ['../**'],
          include: ['test/**', '_warmup/**'],
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
            enabled: true,
            package: {
              individually: true,
              exclude: ['../**'],
              include: ['test/**', '_warmup/**'],
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
        package: {
          individually: true,
          exclude: ['../**'],
          include: ['test/**', '_warmup/**'],
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
            enabled: true,
            folderName: 'test-folder',
            package: {
              individually: true,
              exclude: ['../**'],
              include: ['test/**'],
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
            enabled: true,
            package: {
              individually: false,
              exclude: ['../**'],
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
        handler: '_warmup/index.warmUp',
        package: {
          individually: false,
          exclude: ['../**'],
          include: ['_warmup/**'],
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
            enabled: true,
            package: {
              individually: true,
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
        handler: '_warmup/index.warmUp',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**'],
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
            enabled: true,
            package: {
              exclude: ['**'],
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
        handler: '_warmup/index.warmUp',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**'],
        },
      }));
  });
});
