/* global describe it expect */

const WarmUP = require('../src/index')
const { getServerlessConfig } = require('./utils/configUtils')

describe('Serverless warmup plugin constructor', () => {
  it('Should work with only defaults (no config overrides specified)', () => {
    const serverless = getServerlessConfig()

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, { stage: 'test', region: 'us-west-2' })

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, { stage: 'test', region: 'us-west-2' })

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

  it('Should set the VPC to empty if set to false in options', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            vpc: false
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })

    const plugin = new WarmUP(serverless, {})

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
      vpc: { securityGroupIds: [], subnetIds: [] },
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

  it('Should set the VPC to empty from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] }
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const plugin = new WarmUP(serverless, {})

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
      vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] },
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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

    const plugin = new WarmUP(serverless, {})

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

  describe('Backwards compatibility', () => {
    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: true
            }
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
        }
      })

      const plugin = new WarmUP(serverless, {})

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

    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: 'dev'
            }
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
        }
      })

      const plugin = new WarmUP(serverless, {})

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
        enabled: 'dev',
        source: '{"source":"serverless-plugin-warmup"}',
        concurrency: 1
      }
      expect(plugin.options).toMatchObject(expectedOptions)
      expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
    })

    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: ['dev', 'staging']
            }
          }
        }
      })

      const plugin = new WarmUP(serverless, {})

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
        enabled: ['dev', 'staging'],
        source: '{"source":"serverless-plugin-warmup"}',
        concurrency: 1
      }
      expect(plugin.options).toMatchObject(expectedOptions)
      expect(plugin.warmupOpts).toMatchObject(expectedWarmupOpts)
    })

    it('Should accept backwards compatible "schedule" property as string in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              schedule: 'rate(10 minutes)'
            }
          }
        }
      })

      const plugin = new WarmUP(serverless, {})

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

    it('Should accept backwards compatible "schedule" property as array in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              schedule: ['rate(10 minutes)', 'rate(30 minutes)']
            }
          }
        }
      })

      const plugin = new WarmUP(serverless, {})

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
        events: [{ schedule: 'rate(10 minutes)' }, { schedule: 'rate(30 minutes)' }],
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
  })
})
