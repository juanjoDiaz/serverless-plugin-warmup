const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

(async () => {
  try {
    await fs.stat(path.join(__dirname, '.husky'));
  } catch {
    // We are not in dev.
    return;
  }

  const { stdout, stderr } = await exec('husky install');
  if (stderr) {
    process.stderr.write(stderr);
    process.exit(1);
  }
  process.stdout.write(stdout);
})();
