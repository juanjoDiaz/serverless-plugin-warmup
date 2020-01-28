/* global jest */

class GeneratedFunctionTester {
  constructor(func) {
    this.func = func;
    this.lambdaInstances = [];
    this.aws = {
      config: {},
      Lambda: jest.fn().mockImplementation(() => {
        const invoke = jest.fn().mockReturnValue(Promise.resolve());
        this.lambdaInstances.push(invoke);
        return { invoke };
      }),
    };
  }

  generatedWarmupFunction() {
    // eslint-disable-next-line no-new-func
    return new Function('dependencies', 'process', `
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
      module.exports.warmUp();
    `);
  }

  executeWarmupFunction(process) {
    this.generatedWarmupFunction()({ 'aws-sdk': this.aws }, process || { env: {} });
  }
}

module.exports = { GeneratedFunctionTester };
