/**
 * @description Define the additions to the serverless schema by this plugin.
 * */
function extendServerlessSchema(serverless) {
  // Most of these are taken from
  // https://github.com/serverless/serverless/blob/master/lib/configSchema.js
  // https://github.com/serverless/serverless/blob/master/lib/plugins/aws/provider.js
  // https://github.com/serverless/serverless/blob/master/lib/plugins/aws/package/compile/events/schedule/index.js

  const rateSyntax = '^rate\\((?:1 (?:minute|hour|day)|(?:1\\d+|[2-9]\\d*) (?:minute|hour|day)s)\\)$';
  const cronSyntax = '^cron\\(\\S+ \\S+ \\S+ \\S+ \\S+ \\S+\\)$';
  const scheduleSyntax = `${rateSyntax}|${cronSyntax}`;

  const globalConfigSchemaProperties = {
    folderName: { type: 'string' },
    cleanFolder: { type: 'boolean' },
    name: { type: 'string' },
    role: { $ref: '#/definitions/awsLambdaRole' },
    tags: { $ref: '#/definitions/awsResourceTags' },
    vpc: {
      anyOf: [
        { const: false }, // to deploy outside of the VPC
        { $ref: '#/definitions/awsLambdaVpcConfig' },
      ],
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        anyOf: [
          { type: 'string', pattern: scheduleSyntax },
          {
            type: 'object',
            properties: {
              rate: { type: 'string', pattern: scheduleSyntax },
              enabled: { type: 'boolean' },
              alias: { type: 'string' },
              name: {
                type: 'string', minLength: 1, maxLength: 64, pattern: '[\\.\\-_A-Za-z0-9]+',
              },
              description: { type: 'string', maxLength: 512 },
              // input: {
              //   anyOf: [
              //     { type: 'string', maxLength: 8192 },
              //     {
              //       type: 'object',
              //       oneOf: [
              //         {
              //           properties: {
              //             body: { type: 'string', maxLength: 8192 },
              //           },
              //           required: ['body'],
              //           additionalProperties: false,
              //         },
              //         {
              //           not: {
              //             required: ['body'],
              //           },
              //         },
              //       ],
              //     },
              //   ],
              // },
              // inputPath: { type: 'string', maxLength: 256 },
              // inputTransformer: {
              //   type: 'object',
              //   properties: {
              //     inputTemplate: {
              //       type: 'string',
              //       minLength: 1,
              //       maxLength: 8192,
              //     },
              //     inputPathsMap: { type: 'object' },
              //   },
              //   required: ['inputTemplate'],
              //   additionalProperties: false,
              // },
            },
            required: ['rate'],
            additionalProperties: false,
          },
        ],
      },
    },
    package: {
      type: 'object',
      properties: {
        artifact: { type: 'string' },
        exclude: { type: 'array', items: { type: 'string' } },
        include: { type: 'array', items: { type: 'string' } },
        individually: { type: 'boolean' },
      },
      additionalProperties: false,
    },
    memorySize: { $ref: '#/definitions/awsLambdaMemorySize' },
    timeout: { $ref: '#/definitions/awsLambdaTimeout' },
    environment: { $ref: '#/definitions/awsLambdaEnvironment' },
    tracing: { $ref: '#/definitions/awsLambdaTracing' },
    prewarm: { type: 'boolean' },
  };

  const functionConfigSchemaProperties = {
    enabled: {
      anyOf: [
        { type: 'boolean' },
        { type: 'string' },
        { type: 'array', items: { type: 'string' } },
      ],
    },
    clientContext: {
      anyOf: [
        { const: false }, // to skip it
        { type: 'object' }, // any
      ],
    },
    payload: { type: 'object' }, // any
    payloadRaw: { type: 'boolean' },
    concurrency: { type: 'integer' },
  };

  if (!serverless.configSchemaHandler) return;

  if (typeof serverless.configSchemaHandler.defineCustomProperties === 'function') {
    serverless.configSchemaHandler.defineCustomProperties({
      properties: {
        warmup: {
          '.*': {
            type: 'object',
            properties: { ...globalConfigSchemaProperties, ...functionConfigSchemaProperties },
            additionalProperties: false,
          },
        },
      },
    });
  }

  if (typeof serverless.configSchemaHandler.defineFunctionProperties === 'function') {
    serverless.configSchemaHandler.defineFunctionProperties('aws', {
      type: 'object',
      properties: {
        warmup: {
          '.*': {
            type: 'object',
            properties: { functionConfigSchemaProperties },
            additionalProperties: false,
          },
        },
      },
    });
  }
}

module.exports = {
  extendServerlessSchema,
};
