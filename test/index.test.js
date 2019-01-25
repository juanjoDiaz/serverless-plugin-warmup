/* global describe it expect */

const WarmUP = require('../src/index')

describe('Serverless warmup plugin', () => {
  describe('getFunctionConfig', () => {
    it('Should work with only defaults (no config overrides specified)', () => {
      const defaults = {
        enabled: false,
        sourceRaw: true,
        source: 'whatever',
        concurrency: 1
      }
      const result = WarmUP.prototype.getFunctionConfig(undefined, defaults)

      expect(defaults).toMatchObject(result)
    })

    it('Should accept a configuration object as the first parameter', () => {
      const config = {
        enabled: true,
        sourceRaw: true,
        source: 'whatever',
        concurrency: 1
      }
      const result = WarmUP.prototype.getFunctionConfig(config, undefined)

      expect(config).toMatchObject(result)
    })

    it('Should not include extra properties besides enabled, source and concurrency', () => {
      const config = {
        enabled: false,
        sourceRaw: true,
        source: 'whatever',
        concurrency: 1,
        metadata: 'kentucky fried chicken'
      }
      const result = WarmUP.prototype.getFunctionConfig(config, undefined)

      expect(result).not.toHaveProperty('sourceRaw')
      expect(result).not.toHaveProperty('metadata')
    })

    it('Should stringify the source prop if config.sourceRaw !== true', () => {
      const config = {
        enabled: true,
        source: { source: 'kickass-plugin' },
        concurrency: 1
      }
      const result = WarmUP.prototype.getFunctionConfig(config, undefined)

      expect(result.source).toEqual(JSON.stringify(config.source))
    })

    it('Should give precedence to config over default options', () => {
      const config = {
        enabled: false,
        concurrency: 2
      }

      const defaults = {
        enabled: true,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }",
        concurrency: 1
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: false,
        concurrency: 2,
        source: defaults.source
      })
    })

    it('Should accept a string value (stage) for config.enabled', () => {
      const config = {
        enabled: 'production',
        concurrency: 2
      }

      const defaults = {
        enabled: false,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }",
        concurrency: 1
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: config.enabled,
        concurrency: 2,
        source: defaults.source
      })
    })

    it('Should accept an array of strings (stages) for config.enabled', () => {
      const config = {
        enabled: ['production', 'development'],
        concurrency: 2
      }

      const defaults = {
        enabled: false,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }",
        concurrency: 1
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: config.enabled,
        concurrency: 2,
        source: defaults.source
      })
    })

    it('Should accept backwards compatible config.default property in place of "enabled"', () => {
      const config = {
        default: true,
        concurrency: 2,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }"
      }

      const defaults = {
        enabled: false
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: config.default,
        concurrency: config.concurrency,
        source: config.source
      })
    })

    it('Should accept a boolean value as the first parameter, which will be set as config.enabled', () => {
      const config = true

      const defaults = {
        enabled: false,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }",
        concurrency: 1
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: config,
        concurrency: defaults.concurrency,
        source: defaults.source
      })
    })

    it('Should accept a string value (stage) as the first parameter, which will be set as config.enabled', () => {
      const config = 'production'

      const defaults = {
        enabled: false,
        sourceRaw: true,
        source: "{ source: 'kickass-plugin' }",
        concurrency: 1
      }

      const result = WarmUP.prototype.getFunctionConfig(config, defaults)

      expect(result).toMatchObject({
        enabled: config,
        concurrency: defaults.concurrency,
        source: defaults.source
      })
    })
  })
})
