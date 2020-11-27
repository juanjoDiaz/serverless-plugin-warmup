/* global jest */

class GeneratedFunctionTester {
  constructor(func) {
    this.func = func;
    this.lambdaInstances = [];
    this.aws = {
      config: {},
      Lambda: jest.fn().mockImplementation(() => {
        const invoke = jest.fn().mockReturnValue({
          promise() {
            return Promise.resolve();
          },
        });
        this.lambdaInstances.push(invoke);
        return { invoke };
      }),
    };
  }

  generatedWarmupFunction() {
    // eslint-disable-next-line no-new-func
    return new Function('dependencies', 'process', 'event', `
      console = {
        log: () => {}
      };
      const require = (dep) => {
        if (!dependencies[dep]) {
          throw new Error(\`Unknow dependency (\${dep})\`);
        }

        return dependencies[dep];
      };
      const module = { exports: {} };
      ${this.func}
      module.exports.warmUp(event);
    `);
  }

  executeWarmupFunction({ process = { env: {} }, event = {} } = {}) {
    this.generatedWarmupFunction()({ 'aws-sdk': this.aws }, process, event);
  }
}

module.exports = { GeneratedFunctionTester };
