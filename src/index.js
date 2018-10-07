'use strict'

/**
 * @module serverless-plugin-warmup
 *
 * @see {@link https://serverless.com/framework/docs/providers/aws/guide/plugins/}
 *
 * @requires 'bluebird'
 * @requires 'fs-extra'
 * @requires 'path'
 * @requires 'archiver'
 * */
const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs-extra'))
const path = require('path')
const archiver = require('archiver')

const artifactPath = './.serverless/_warmup.zip'

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

    this.provider = this.serverless.getProvider('aws')

    this.hooks = {
      'after:package:initialize': this.afterPackageInitialize.bind(this),
      'after:package:createDeploymentArtifacts': this.afterCreateDeploymentArtifacts.bind(this),
      'after:deploy:deploy': this.afterDeployFunctions.bind(this)
    }
  }

  archiveDirectory (src, dest, format = 'zip', archiverOptions = {}, directoryDestPath = false) {
    return new Promise((resolve, reject) => {
      const archive = archiver(format, archiverOptions)
      const output = fs.createWriteStream(dest)
      archive.pipe(output)
      archive.directory(src, directoryDestPath)
      archive.finalize()
      output.on('close', () => resolve(archive))
      archive.on('error', (err) => reject(err))
      archive.on('warning', (err) => this.serverless.cli.log(err))
    })
  }

  /**
   * @description After package initialize hook. Create warmer function and add it to the service.
   *
   * @fulfil {} — Warm up set
   * @reject {Error} Warm up error
   *
   * @return {(boolean|Promise)}
   * */
  afterPackageInitialize () {  /* eslint-disable operator-linebreak */
    // See https://github.com/serverless/serverless/issues/2631
    this.options.stage = this.options.stage
      || this.serverless.service.provider.stage
      || (this.serverless.service.defaults && this.serverless.service.defaults.stage)
      || 'dev'
    this.options.region = this.options.region
      || this.serverless.service.provider.region
      || (this.serverless.service.defaults && this.serverless.service.defaults.region)
      || 'us-east-1'
    this.custom = this.serverless.service.custom

    this.configPlugin()
    return this.createWarmer()
  }

  /**
   * @description After create deployment artifacts. Clean prefix folder.
   *
   * @fulfil {} — Optimization finished
   * @reject {Error} Optimization error
   *
   * @return {Promise}
   * */
  afterCreateDeploymentArtifacts () {
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
    this.configPlugin()
    let promise = Promise.resolve()

    if (this.warmup.cleanFolder) {
      promise = promise.then(() => fs.removeAsync(this.pathArchive))
    }

    if (this.warmup.prewarm) {
      promise = promise.then(this.warmUpFunctions)
    }

    return promise
  }

  /**
   * @description Configure the plugin based on the context of serverless.yml
   *
   * @return {}
   * */
  configPlugin () {
    /** Set warm up folder, file and handler paths */
    this.folderName = '_warmup'
    if (this.custom && this.custom.warmup && typeof this.custom.warmup.folderName === 'string') {
      this.folderName = this.custom.warmup.folderName
    }
    this.pathFolder = this.getPath(this.folderName)
    this.pathArchive = this.getPath(artifactPath)
    this.pathFile = this.pathFolder + '/index.js'
    this.pathHandler = this.folderName + '/index.warmUp'

    /** Default options */
    this.warmup = {
      cleanFolder: true,
      memorySize: 128,
      name: this.serverless.service.service + '-' + this.options.stage + '-warmup-plugin',
      schedule: ['rate(5 minutes)'],
      timeout: 10,
      prewarm: false
    }

    /** Set global custom options */
    if (!this.custom || !this.custom.warmup) {
      return
    }

    /** Clean folder */
    if (typeof this.custom.warmup.cleanFolder === 'boolean') {
      this.warmup.cleanFolder = this.custom.warmup.cleanFolder
    }

    /** Memory size */
    if (typeof this.custom.warmup.memorySize === 'number') {
      this.warmup.memorySize = this.custom.warmup.memorySize
    }

    /** Function name */
    if (typeof this.custom.warmup.name === 'string') {
      this.warmup.name = this.custom.warmup.name
    }

    /** Role */
    if (typeof this.custom.warmup.role === 'string') {
      this.warmup.role = this.custom.warmup.role
    }

    /** Tags */
    if (typeof this.custom.warmup.tags === 'object') {
      this.warmup.tags = this.custom.warmup.tags
    }

    /** Schedule expression */
    if (typeof this.custom.warmup.schedule === 'string') {
      this.warmup.schedule = [this.custom.warmup.schedule]
    } else if (Array.isArray(this.custom.warmup.schedule)) {
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
   * @description Create zip artifact
   *
   * @fulfil {Archiver} — Artifact created
   * @reject {Error} File system error
   *
   * @return {Promise}
   */
  createArtifact () {
    const src = this.pathFolder + (this.pathFolder.endsWith('/') ? '' : '/')
    return this.archiveDirectory(src, this.pathArchive, 'zip', { zlib: { level: 9 } }, this.folderName)
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
    if (!this.warmup.cleanFolder) {
      return Promise.resolve()
    }
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
      if (functionObject.warmup === true ||
        functionObject.warmup === this.options.stage ||
        (Array.isArray(functionObject.warmup) &&
          functionObject.warmup.indexOf(this.options.stage) !== -1)) {
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
    const warmUpFunction = `"use strict";

/** Generated by Serverless WarmUP Plugin at ${new Date().toISOString()} */
const aws = require("aws-sdk");
aws.config.region = "${this.options.region}";
const lambda = new aws.Lambda();
const functionNames = "${functionNames.join()}".split(",");
module.exports.warmUp = (event, context, callback) => {
  let invokes = [];
  let errors = 0;
  console.log("Warm Up Start");
  functionNames.forEach((functionName) => {
    const params = {
      // base64 encoded: {"custom":{"warmupEvent":"1"}}
      ClientContext: "eyJjdXN0b20iOnsid2FybXVwRXZlbnQiOiIxIn19",
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      LogType: "None",
      Qualifier: process.env.SERVERLESS_ALIAS || "$LATEST",
      Payload: JSON.stringify({ source: "serverless-plugin-warmup" })
    };
    invokes.push(lambda.invoke(params).promise().then((data) => {
      console.log("Warm Up Invoke Success: " + functionName, data);
    }, (error) => {
      errors++;
      console.log("Warm Up Invoke Error: " + functionName, error);
    }));
  });
  Promise.all(invokes).then(() => {
    console.log("Warm Up Finished with " + errors + " invoke errors");
    callback();
  });
}`

    /** Write warm up file */
    return fs.outputFileAsync(this.pathFile, warmUpFunction)
      .then(res => this.createArtifact().then(() => res))
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
      events: this.warmup.schedule.map(schedule => ({ schedule })),
      handler: this.pathHandler,
      memorySize: this.warmup.memorySize,
      name: this.warmup.name,
      runtime: 'nodejs6.10',
      package: {
        individually: true,
        exclude: ['**'],
        include: [this.folderName + '/**'],
        artifact: artifactPath
      },
      timeout: this.warmup.timeout
    }

    if (this.warmup.role) {
      this.serverless.service.functions.warmUpPlugin.role = this.warmup.role
    }

    if (this.warmup.tags) {
      this.serverless.service.functions.warmUpPlugin.tags = this.warmup.tags
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
