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

    /** AWS provider and node4.3 runtime check */
    if (this.serverless.service.provider.name === 'aws' && this.serverless.service.provider.runtime === 'nodejs4.3') {
      /** Serverless hooks */
      this.hooks = {
        'after:deploy:initialize': this.afterDeployInitialize.bind(this),
        'after:deploy:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this)
      }
    }
  }

  /**
   * @description Deploy hook
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {(boolean|Promise)}
   * */
  afterDeployInitialize () {
    /** Set warm up folder, file and handler paths */
    this.folderName = '_warmup'
    this.pathFolder = this.getPath(this.folderName)
    this.pathFile = this.pathFolder + '/index.js'
    this.pathHandler = this.folderName + '/index.warmUp'

    /** Default options */
    this.warmup = {
      memorySize: 128,
      name: 'warmup-plugin-' + this.options.stage,
      schedule: 'rate(5 minutes)',
      timeout: 10
    }

    /** Set global custom options */
    if (this.custom && this.custom.warmup) {
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
    }

    /** Warm up functions */
    return this.warmUpFunctions()
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
   * @fulfil {} — Warm up lambda created and added to service
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  warmUpFunctions () {
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
      return this.writeWarmUpFunction(functionNames)
    }).then((skip) => {
      /** Add warm up function to service */
      if (skip !== true) {
        return this.addWarmUpToService()
      }
    })
  }

  /**
   * @description Write warm up ES6 function
   *
   * @param {Array} functionNames - Function names
   *
   * @fulfil {} — Warm up lambda created
   * @reject {Error} Warm up error
   *
   * @return {Promise}
   * */
  writeWarmUpFunction (functionNames) {
    /** Log warmup start */
    this.serverless.cli.log('WarmUP: setting ' + functionNames.length + ' lambdas to be warm')

    /** Get function names */
    functionNames = functionNames.map((functionName) => {
      const functionObject = this.serverless.service.getFunction(functionName)
      this.serverless.cli.log('WarmUP: ' + functionObject.name)
      return functionObject.name
    })

    /** Write lambda invoke promises and push to array */
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
      '      Payload: "{\\"source\\": \\"serverless-plugin-warmup\\"}"\n' +
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
  addWarmUpToService () {
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
      package: {
        exclude: ['**'],
        include: [this.folderName + '/**']
      },
      timeout: this.warmup.timeout
    }

    /** Return service function object */
    return this.serverless.service.functions.warmUpPlugin
  }
}

/** Export WarmUP class */
module.exports = WarmUP
