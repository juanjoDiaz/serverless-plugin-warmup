/* global describe it expect */

const WarmUP = require('../src/index')
const { getServerlessConfig, getOptions } = require('./utils/configUtils')

describe('Serverless warmup plugin constructor', () => {
  it('Should work with only defaults (no config overrides specified)', () => {
    const serverless = getServerlessConfig()
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the stage and region from defaults if present', () => {
    const serverless = getServerlessConfig({
      service: {
        defaults: { stage: 'staging', region: 'eu-west-1' }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'staging',
      region: 'eu-west-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-staging-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the stage and region from provider if present', () => {
    const serverless = getServerlessConfig({
      service: {
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'prod',
      region: 'eu-west-2'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-prod-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the stage and region from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' }
      }
    })
    const options = getOptions({ stage: 'test', region: 'us-west-2' })

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'test',
      region: 'us-west-2'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-test-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the folder name from custom config', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            folderName: 'test-folder'
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: 'test-folder',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/test-folder/index.js',
      pathFolder: 'testPath/test-folder',
      pathHandler: 'test-folder/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should set clean folder option to true from custom config', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            cleanFolder: true
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should set clean folder option to false from custom config', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            cleanFolder: false
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: false,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the service name from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            name: 'test-name'
          }
        }
      }
    })
    const options = getOptions({ stage: 'test', region: 'us-west-2' })

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'test',
      region: 'us-west-2'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'test-name',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the service roles from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            role: 'test-role'
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: 'test-role',
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the service tag from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            tags: {
              tag1: 'test-tag-1',
              tag2: 'test-tag-2'
            }
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: {
        tag1: 'test-tag-1',
        tag2: 'test-tag-2'
      },
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the service schedule from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            events: [{ schedule: 'rate(10 minutes)' }]
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(10 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the memory size from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            memorySize: 256
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 256,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the timeout from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            timeout: 30
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 30,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the prewarm option from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            prewarm: true
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: true,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the enable option from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: true,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the source from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            source: {
              test: 123
            }
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"test":123}',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should stringify the source by default', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            source: '123'
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '"123"',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should stringify the source if sourceRaw is set to false', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            source: '123',
            sourceRaw: false
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '"123"',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should not stringify the source if sourceRaw is set to true', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            source: '123',
            sourceRaw: true
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '123',
      concurrency: 1
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })

  it('Should use the concurrency from options if present', () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            concurrency: 3
          }
        }
      }
    })
    const options = getOptions()

    const plugin = new WarmUP(serverless, options)

    const expectedOptions = {
      stage: 'dev',
      region: 'us-east-1'
    }
    const expectedWarmupOpts = {
      folderName: '_warmup',
      cleanFolder: true,
      name: 'warmup-test-dev-warmup-plugin',
      pathFile: 'testPath/_warmup/index.js',
      pathFolder: 'testPath/_warmup',
      pathHandler: '_warmup/index.warmUp',
      role: undefined,
      tags: undefined,
      events: [{ schedule: 'rate(5 minutes)' }],
      memorySize: 128,
      timeout: 10,
      prewarm: false,
      enabled: false,
      source: '{"source":"serverless-plugin-warmup"}',
      concurrency: 3
    }
    expect(plugin.options).toMatchObject(expectedOptions)
    expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
  })
})
