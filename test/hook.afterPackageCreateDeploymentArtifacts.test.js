/* global jest beforeEach describe it expect */

const WarmUp = require('../src/index')
const { getServerlessConfig } = require('./utils/configUtils')

jest.mock('fs-extra')
const fs = require('fs-extra')

describe('Serverless warmup plugin after:deploy:deploy hook', () => {
  beforeEach(() => fs.remove.mockClear())

  it('Should clean the temporary folder if cleanFolder is set to true', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) }
    const serverless = getServerlessConfig({
      getProvider () { return mockProvider },
      service: {
        custom: {
          warmup: {
            enabled: true,
            cleanFolder: true
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const plugin = new WarmUp(serverless, {})

    await plugin.hooks['after:package:createDeploymentArtifacts']()

    expect(fs.remove).toHaveBeenCalledTimes(1)
    expect(fs.remove).toHaveBeenCalledWith('testPath/_warmup')
  })

  it('Should clean the custom temporary folder if cleanFolder is set to true', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) }
    const serverless = getServerlessConfig({
      getProvider () { return mockProvider },
      service: {
        custom: {
          warmup: {
            enabled: true,
            folderName: 'test-folder',
            cleanFolder: true
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const plugin = new WarmUp(serverless, {})

    await plugin.hooks['after:package:createDeploymentArtifacts']()

    expect(fs.remove).toHaveBeenCalledTimes(1)
    expect(fs.remove).toHaveBeenCalledWith('testPath/test-folder')
  })

  it('Should not clean the temporary folder if cleanFolder is set to false', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) }
    const serverless = getServerlessConfig({
      getProvider () { return mockProvider },
      service: {
        custom: {
          warmup: {
            enabled: true,
            cleanFolder: false
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const plugin = new WarmUp(serverless, {})

    await plugin.hooks['after:package:createDeploymentArtifacts']()

    expect(fs.remove).not.toHaveBeenCalled()
  })

  it('Should have default global package property', async () => {
    const mockProvider = { request: jest.fn(() => Promise.resolve()) }
    const serverless = getServerlessConfig({
      getProvider () { return mockProvider },
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const plugin = new WarmUp(serverless, {})

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin.package)
      .toEqual({
        individually: true,
        exclude: ['**'],
        include: ['_warmup/**']
      })
  })
})

it('Should override global package property', async () => {
  const mockProvider = { request: jest.fn(() => Promise.resolve()) }
  const serverless = getServerlessConfig({
    getProvider () { return mockProvider },
    service: {
      custom: {
        warmup: {
          enabled: true,
          package: {
            individually: true,
            exclude: ['../**']
          }
        }
      },
      functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
    }
  })
  const plugin = new WarmUp(serverless, {})

  await plugin.hooks['after:package:initialize']()

  expect(plugin.serverless.service.functions.warmUpPlugin.package)
    .toEqual({
      individually: true,
      include: ['_warmup/**'],
      exclude: ['../**']
    })
})

it('Should override global package property with existing includes', async () => {
  const mockProvider = { request: jest.fn(() => Promise.resolve()) }
  const serverless = getServerlessConfig({
    getProvider () { return mockProvider },
    service: {
      custom: {
        warmup: {
          enabled: true,
          package: {
            individually: true,
            include: ['test/**'],
            exclude: ['../**']
          }
        }
      },
      functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
    }
  })
  const plugin = new WarmUp(serverless, {})

  await plugin.hooks['after:package:initialize']()

  expect(plugin.serverless.service.functions.warmUpPlugin.package)
    .toEqual({
      individually: true,
      include: ['test/**', '_warmup/**'],
      exclude: ['../**']
    })
})

it('Should override global package property with existing includes with warmup function', async () => {
  const mockProvider = { request: jest.fn(() => Promise.resolve()) }
  const serverless = getServerlessConfig({
    getProvider () { return mockProvider },
    service: {
      custom: {
        warmup: {
          enabled: true,
          package: {
            individually: true,
            include: ['test/**', '_warmup/**'],
            exclude: ['../**']
          }
        }
      },
      functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
    }
  })
  const plugin = new WarmUp(serverless, {})

  await plugin.hooks['after:package:initialize']()

  expect(plugin.serverless.service.functions.warmUpPlugin.package)
    .toEqual({
      individually: true,
      include: ['test/**', '_warmup/**'],
      exclude: ['../**']
    })
})

it('Should override global package property function with a unique folder name', async () => {
  const mockProvider = { request: jest.fn(() => Promise.resolve()) }
  const serverless = getServerlessConfig({
    getProvider () { return mockProvider },
    service: {
      custom: {
        warmup: {
          enabled: true,
          folderName: 'test-folder',
          package: {
            individually: true,
            include: ['test/**'],
            exclude: ['../**']
          }
        }
      },
      functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
    }
  })
  const plugin = new WarmUp(serverless, {})

  await plugin.hooks['after:package:initialize']()

  expect(plugin.serverless.service.functions.warmUpPlugin.package)
    .toEqual({
      individually: true,
      include: ['test/**', 'test-folder/**'],
      exclude: ['../**']
    })
})
