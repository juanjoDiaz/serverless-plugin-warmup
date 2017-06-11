'use strict'

/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'bluebird'
 * @requires 'fs-extra'
 * @requires 'path'
 * */
const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs-extra'))
const path = require('path')

/**
 * @classdesc Keep your lambdas warm during Winter
 * @class WarmUP
 * */
class WarmUP {
  /**
   * @description Serverless Warm Up
   * @constructor
   *
   * @param {!Object} serverless - Serverless object
   * @param {!Object} options - Serverless options
   * */
  constructor (serverless, options) {
    /** Serverless variables */
    this.serverless = serverless
    this.options = options
    this.custom = this.serverless.service.custom

    this.provider = this.serverless.getProvider('aws')

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this)
    }
  }

  /**
   * @description After package initialize hook
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {(boolean|Promise)}
   * */
  afterPackageInitialize () {
    this.configPlugin()

    /** Create warmer function and add it to the service */
    return this.createWarmer()
  }

  /**
   * @description After create deployment artifacts
   *
   * @fulfil {} — Optimization finished
   * @reject {Error} Optimization error
   *
   * @return {Promise}
   * */
  afterCreateDeploymentArtifacts () {
    /** Clean prefix folder */
    return this.cleanFolder()
  }

  /**
   * @description After deploy functions hooks
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  afterDeployFunctions () {
    if (this.warmup.prewarm) {
      return this.warmUpFunctions()
    }
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {}
   * */
  configPlugin () {
    /** Set warm up folder, file and handler paths */
    this.folderName = '_warmup'
    this.pathFolder = this.getPath(this.folderName)
    this.pathFile = this.pathFolder + '/index.js'
    this.pathHandler = this.folderName + '/index.warmUp'

    /** Default options */
    this.warmup = {
      memorySize: 128,
      name: this.serverless.service.service + '-' + this.options.stage + 'warmup-plugin',
      schedule: 'rate(5 minutes)',
      timeout: 10,
      prewarm: false
    }

    /** Set global custom options */
    if (!this.custom || !this.custom.warmup) {
      return
    }

    /** Memory size */
    if (typeof this.custom.warmup.memorySize === 'number') {
      this.warmup.memorySize = this.custom.warmup.memorySize
    }

    /** Function name */
    if (typeof this.custom.warmup.name === 'string') {
      this.warmup.name = this.custom.warmup.name
    }

    /** Schedule expression */
    if (typeof this.custom.warmup.schedule === 'string') {
      this.warmup.schedule = this.custom.warmup.schedule
    }

    /** Timeout */
    if (typeof this.custom.warmup.timeout === 'number') {
      this.warmup.timeout = this.custom.warmup.timeout
    }

    /** Pre-warm */
    if (typeof this.custom.warmup.prewarm === 'boolean') {
      this.warmup.prewarm = this.custom.warmup.prewarm
    }
  }

  /**
   * @description After create deployment artifacts
   *
   * @param {string} file — File path
   *
   * @return {String} Absolute file path
   * */
  getPath (file) {
    return path.join(this.serverless.config.servicePath, file)
  }

  /**
   * @description Clean prefix folder
   *
   * @fulfil {} — Folder cleaned
   * @reject {Error} File system error
   *
   * @return {Promise}
   * */
  cleanFolder () {
    return fs.removeAsync(this.pathFolder)
  }

  /**
   * @description Warm up functions
   *
   * @fulfil {} — Warm up function created and added to service
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  createWarmer () {
    /** Get functions */
    const allFunctions = this.serverless.service.getAllFunctions()

    /** Filter functions for warm up */
    return BbPromise.filter(allFunctions, (functionName) => {
      const functionObject = this.serverless.service.getFunction(functionName)

      /** Function needs to be warm */
      if (functionObject.warmup === true) {
        return functionObject
      }
    }).then((functionNames) => {
      /** Skip writing if no functions need to be warm */
      if (!functionNames.length) {
        /** Log no warmup */
        this.serverless.cli.log('WarmUP: no lambda to warm')
        return true
      }

      /** Write warm up function */
      return this.createWarmUpFunctionArtifact(functionNames)
    }).then((skip) => {
      /** Add warm up function to service */
      if (skip !== true) {
        return this.addWarmUpFunctionToService()
      }
    })
  }

  /**
   * @description Write warm up ES6 function
   *
   * @param {Array} functionNames - Function names
   *
   * @fulfil {} — Warm up function created
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  createWarmUpFunctionArtifact (functionNames) {
    /** Log warmup start */
    this.serverless.cli.log('WarmUP: setting ' + functionNames.length + ' lambdas to be warm')

    /** Get function names */
    functionNames = functionNames.map((functionName) => {
      const functionObject = this.serverless.service.getFunction(functionName)
      this.serverless.cli.log('WarmUP: ' + functionObject.name)
      return functionObject.name
    })

    /** Write function invoke promises and push to array */
    const warmUpFunction = '"use strict";\n\n' +
      '/** Generated by Serverless WarmUP Plugin at ' + new Date().toISOString() + ' */\n' +
      'const aws = require("aws-sdk");\n' +
      'aws.config.region = "' + this.serverless.service.provider.region + '";\n' +
      'const lambda = new aws.Lambda();\n' +
      'const functionNames = "' + functionNames.join() + '".split(",");\n' +
      'module.exports.warmUp = (event, context, callback) => {\n' +
      '  let invokes = [];\n' +
      '  let errors = 0;\n' +
      '  console.log("Warm Up Start");\n' +
      '  functionNames.forEach((functionName) => {\n' +
      '    const params = {\n' +
      '      FunctionName: functionName,\n' +
      '      InvocationType: "RequestResponse",\n' +
      '      LogType: "None",\n' +
      '      Qualifier: process.env.SERVERLESS_ALIAS || "$LATEST",\n' +
      '      Payload: JSON.stringify({ source: "serverless-plugin-warmup" })\n' +
      '    };\n' +
      '    invokes.push(lambda.invoke(params).promise().then((data) => {\n' +
      '      console.log("Warm Up Invoke Success: " + functionName + "", data);\n' +
      '    }, (error) => {\n' +
      '      errors++;\n' +
      '      console.log("Warm Up Invoke Error: " + functionName + "", error);\n' +
      '    }));\n' +
      '  });\n' +
      '  Promise.all(invokes).then(() => {\n' +
      '    console.log("Warm Up Finished with " + errors + " invoke errors");\n' +
      '    callback();\n' +
      '  });\n' +
      '}'

    /** Write warm up file */
    return fs.outputFileAsync(this.pathFile, warmUpFunction)
  }

  /**
   * @description Add warm up function to service
   *
   * @return {Object} Warm up service function object
   * */
  addWarmUpFunctionToService () {
    /** SLS warm up function */
    this.serverless.service.functions.warmUpPlugin = {
      description: 'Serverless WarmUP Plugin',
      events: [
        {
          schedule: this.warmup.schedule
        }
      ],
      handler: this.pathHandler,
      memorySize: this.warmup.memorySize,
      name: this.warmup.name,
      runtime: 'nodejs6.10',
      package: {
        exclude: ['**'],
        include: [this.folderName + '/**']
      },
      timeout: this.warmup.timeout
    }

    /** Return service function object */
    return this.serverless.service.functions.warmUpPlugin
  }

  /**
   * @description Warm up the functions immediately after deployment
   *
   * @fulfil {} — Functions warmed up sucessfuly
   * @reject {Error} Functions couldn't be warmed up
   *
   * @return {Promise}
   * */
  warmUpFunctions () {
    this.serverless.cli.log('WarmUP: Pre-warming up your functions')

    const params = {
      FunctionName: this.warmup.name,
      InvocationType: 'RequestResponse',
      LogType: 'None',
      Qualifier: process.env.SERVERLESS_ALIAS || '$LATEST',
      Payload: JSON.stringify({ source: 'serverless-plugin-warmup' })
    }

    return this.provider.request('Lambda', 'invoke', params)
      .then(data => this.serverless.cli.log('WarmUp: Functions sucessfuly pre-warmed'))
      .catch(error => this.serverless.cli.log('WarmUp: Error while pre-warming functions', error))
  }
}

/** Export WarmUP class */
module.exports = WarmUP
