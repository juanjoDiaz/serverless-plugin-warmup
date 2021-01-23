/* global jest describe it expect */

const WarmUp = require('../src/index');
const { getServerlessConfig } = require('./utils/configUtils');

describe('Backward compatibility', () => {
  describe('configSchemaHandler', () => {
    it('should not set the schema if configSchemaHandler is undefined', async () => {
      const serverless = getServerlessConfig({
        configSchemaHandler: null,
      });

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {});
    });

    it('should not define custom properties if defineCustomProperties is undefined', async () => {
      const defineCustomProperties = null;
      const defineFunctionProperties = jest.fn(() => {});
      const serverless = getServerlessConfig({
        configSchemaHandler: {
          defineCustomProperties,
          defineFunctionProperties,
        },
      });

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {});

      expect(defineFunctionProperties).toHaveBeenCalledTimes(1);
    });

    it('should not define function properties if defineFunctionProperties is undefined', async () => {
      const defineCustomProperties = jest.fn(() => {});
      const defineFunctionProperties = null;
      const serverless = getServerlessConfig({
        configSchemaHandler: {
          defineCustomProperties,
          defineFunctionProperties,
        },
      });

      // eslint-disable-next-line no-new
      new WarmUp(serverless, {});

      expect(defineCustomProperties).toHaveBeenCalledTimes(1);
    });
  });
});
