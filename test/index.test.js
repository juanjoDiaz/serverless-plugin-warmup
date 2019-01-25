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

  describe('createWarmupFunctionArtifact', () => {
    // Fake 'this' context for WarmUP class
    const mockCtx = {
      options: {
        region: 'us-east-1'
      },
      warmupOpts: {
        pathFile: 'some/gosh/darned/path/file.js'
      },
      serverless: {
        cli: {
          log: () => null
        }
      }
    }

    // Fake fs that just returns the path and the generated JS string
    const mockFs = { outputFile: (path, funcString) => ({ path, funcString }) }

    // Some test lambdas
    const testFunc1 = {
      name: 'someFunc1',
      config: {
        concurrency: 2,
        enabled: true,
        source: 'sauce'
      }
    }
    const testFunc2 = {
      name: 'someFunc2',
      config: {
        concurrency: 3,
        enabled: 'production',
        source: 'meatball sauce'
      }
    }
    const functions = [testFunc1, testFunc2]

    // Call the artifact creator function
    const result = WarmUP.prototype.createWarmUpFunctionArtifact.call(mockCtx, functions, mockFs)

    // Fake context for the generated warmer, used to track what happens when the function is invoked
    const testCtx = {
      lambdaConstructed: false,
      exportedFunc: null,
      lambdaInvocations: []
    }

    // Wrap the artifact in a closure that dispatches changes to testCtx when something we want to test happens
    const ctxWrapper = `
    const testCtx = this;
    const module = {
      exports: {
        set warmUp(val) {
          testCtx.exportedFunc = val;
        }
      }
    }
    const require = () => {
      testCtx.aws = {
        config: {},
        Lambda: function Lambda() { testCtx.lambdaConstructed = true; }
      };
      testCtx.aws.Lambda.prototype.invoke = function (params) {
        testCtx.lambdaInvocations.push(params.FunctionName);
        return {
          promise() {
            return Promise.resolve();
          }
        }
      }
      return testCtx.aws;
    }
    return function() { ${result.funcString} }
    `

    // eslint-disable-next-line no-new-func
    const warmupExporterFunc = new Function(ctxWrapper).call(testCtx)

    // Export the warmup lambda
    warmupExporterFunc()

    it('Should construct an AWS lambda', () => {
      expect(testCtx.lambdaConstructed).toBe(true)
    })

    it('Should have the right configured region', () => {
      expect(testCtx.aws.config.region).toBe(mockCtx.options.region)
    })

    it('Should export a function from the module', () => {
      expect(testCtx.exportedFunc).toBeInstanceOf(Function)
    })

    describe('The exported warmup lambda', () => {
      it('Should invoke the configured lambdas the correct number of times', (done) => {
        testCtx.exportedFunc().then(() => {
          expect(testCtx.lambdaInvocations.filter(func => func === testFunc1.name)).toHaveLength(testFunc1.config.concurrency)
          expect(testCtx.lambdaInvocations.filter(func => func === testFunc2.name)).toHaveLength(testFunc2.config.concurrency)
          done()
        }).catch(e => {
          throw e
        })
      })
    })
  })
})
