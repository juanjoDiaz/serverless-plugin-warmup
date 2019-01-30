/* global jest beforeEach describe it expect */

const WarmUP = require('../src/index')
const { getServerlessConfig, getOptions } = require('./utils/configUtils')

jest.mock('fs-extra')
const fs = require('fs-extra')
fs.outputFile.mockReturnValue(Promise.resolve())

describe('Serverless warmup plugin constructor', () => {
  beforeEach(() => fs.outputFile.mockClear())

  it('Should work with only defaults and do nothing', async () => {
    const serverless = getServerlessConfig({
      service: {
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined()
  })

  it('Should work with only defaults and do nothing if no functions are enabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        functions: {
          someFunc1: { name: 'someFunc1', warmup: { enabled: false } },
          someFunc2: { name: 'someFunc2', warmup: { enabled: false } }
        }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin).toBeUndefined()
  })

  it('Should work with only defaults and do nothing if no functions are enabled', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the stage and region from defaults if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-staging-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the stage and region from provider if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-prod-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the stage and region from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true
          }
        },
        provider: { stage: 'prod', region: 'eu-west-2' },
        defaults: { stage: 'staging', region: 'eu-west-1' },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions({ stage: 'test', region: 'us-west-2' })
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-test-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the folder name from custom config', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            folderName: 'test-folder'
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: 'test-folder/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['test-folder/**']
        },
        timeout: 10
      })
  })

  it('Should use the service name from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            name: 'test-name'
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions({ stage: 'test', region: 'us-west-2' })
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'test-name',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the service roles from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            role: 'test-role'
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10,
        role: 'test-role'
      })
  })

  it('Should use the service tag from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            tags: {
              tag1: 'test-tag-1',
              tag2: 'test-tag-2'
            }
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10,
        tags: {
          tag1: 'test-tag-1',
          tag2: 'test-tag-2'
        }
      })
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
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10,
        vpc: { securityGroupIds: [], subnetIds: [] }
      })
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
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10,
        vpc: { securityGroupIds: ['sg-test1', 'sg-test2'], subnetIds: ['sn-test1', 'sn-test2'] }
      })
  })

  it('Should use the service schedule from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            events: [{ schedule: 'rate(10 minutes)' }]
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(10 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the memory size from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            memorySize: 256
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 256,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 10
      })
  })

  it('Should use the timeout from options if present', async () => {
    const serverless = getServerlessConfig({
      service: {
        custom: {
          warmup: {
            enabled: true,
            timeout: 30
          }
        },
        functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
      }
    })
    const options = getOptions()
    const plugin = new WarmUP(serverless, options)

    await plugin.hooks['after:package:initialize']()

    expect(plugin.serverless.service.functions.warmUpPlugin)
      .toMatchObject({
        description: 'Serverless WarmUP Plugin',
        events: [{ schedule: 'rate(5 minutes)' }],
        handler: '_warmup/index.warmUp',
        memorySize: 128,
        name: 'warmup-test-dev-warmup-plugin',
        runtime: 'nodejs8.10',
        package: {
          individually: true,
          exclude: ['**'],
          include: ['_warmup/**']
        },
        timeout: 30
      })
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
      const options = getOptions()
      const plugin = new WarmUP(serverless, options)

      await plugin.hooks['after:package:initialize']()

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toMatchObject({
          description: 'Serverless WarmUP Plugin',
          events: [{ schedule: 'rate(5 minutes)' }],
          handler: '_warmup/index.warmUp',
          memorySize: 128,
          name: 'warmup-test-dev-warmup-plugin',
          runtime: 'nodejs8.10',
          package: {
            individually: true,
            exclude: ['**'],
            include: ['_warmup/**']
          },
          timeout: 10
        })
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
      const options = getOptions()
      const plugin = new WarmUP(serverless, options)

      await plugin.hooks['after:package:initialize']()

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toMatchObject({
          description: 'Serverless WarmUP Plugin',
          events: [{ schedule: 'rate(5 minutes)' }],
          handler: '_warmup/index.warmUp',
          memorySize: 128,
          name: 'warmup-test-dev-warmup-plugin',
          runtime: 'nodejs8.10',
          package: {
            individually: true,
            exclude: ['**'],
            include: ['_warmup/**']
          },
          timeout: 10
        })
    })

    it('Should accept backwards compatible "default" as boolean property in place of "enabled"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              default: ['dev', 'staging']
            }
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
        }
      })
      const options = getOptions()
      const plugin = new WarmUP(serverless, options)

      await plugin.hooks['after:package:initialize']()

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toMatchObject({
          description: 'Serverless WarmUP Plugin',
          events: [{ schedule: 'rate(5 minutes)' }],
          handler: '_warmup/index.warmUp',
          memorySize: 128,
          name: 'warmup-test-dev-warmup-plugin',
          runtime: 'nodejs8.10',
          package: {
            individually: true,
            exclude: ['**'],
            include: ['_warmup/**']
          },
          timeout: 10
        })
    })

    it('Should accept backwards compatible "schedule" property as string in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              schedule: 'rate(10 minutes)'
            }
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
        }
      })
      const options = getOptions()
      const plugin = new WarmUP(serverless, options)

      await plugin.hooks['after:package:initialize']()

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toMatchObject({
          description: 'Serverless WarmUP Plugin',
          events: [{ schedule: 'rate(10 minutes)' }],
          handler: '_warmup/index.warmUp',
          memorySize: 128,
          name: 'warmup-test-dev-warmup-plugin',
          runtime: 'nodejs8.10',
          package: {
            individually: true,
            exclude: ['**'],
            include: ['_warmup/**']
          },
          timeout: 10
        })
    })

    it('Should accept backwards compatible "schedule" property as array in place of "events"', async () => {
      const serverless = getServerlessConfig({
        service: {
          custom: {
            warmup: {
              enabled: true,
              schedule: ['rate(10 minutes)', 'rate(30 minutes)']
            }
          },
          functions: { someFunc1: { name: 'someFunc1' }, someFunc2: { name: 'someFunc2' } }
        }
      })
      const options = getOptions()
      const plugin = new WarmUP(serverless, options)

      await plugin.hooks['after:package:initialize']()

      expect(plugin.serverless.service.functions.warmUpPlugin)
        .toMatchObject({
          description: 'Serverless WarmUP Plugin',
          events: [{ schedule: 'rate(10 minutes)' }, { schedule: 'rate(30 minutes)' }],
          handler: '_warmup/index.warmUp',
          memorySize: 128,
          name: 'warmup-test-dev-warmup-plugin',
          runtime: 'nodejs8.10',
          package: {
            individually: true,
            exclude: ['**'],
            include: ['_warmup/**']
          },
          timeout: 10
        })
    })
  })
})
