/* global jest beforeEach describe it expect */

const WarmUP = require('../src/index')
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
    const plugin = new WarmUP(serverless, {})

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
    const plugin = new WarmUP(serverless, {})

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
    const plugin = new WarmUP(serverless, {})

    await plugin.hooks['after:package:createDeploymentArtifacts']()

    expect(fs.remove).not.toHaveBeenCalled()
  })
})
