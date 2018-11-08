const childProcess = require('child_process');
const path = require('path');

/**
 * Bytecode prefix for confidential contracts.
 */
const CONFIDENTIAL_PREFIX = '0x00656e63';
/**
 * Directory holding all rust crates representing wasm contracts, relative to
 * the truffle project directory.
 */
const CONTRACTS_DIR = '/contracts';
/**
 * Output directory for the intermediate compiled contract output. Truffle will
 * use this to fetch our artifacts and create new ones that will eventually end
 * up in build/contracts/.
 */
const OASIS_BUILD_DIR = '/.oasis-build';
/**
 * Truffle build path relative to the truffle root directory.
 */
const TRUFFLE_BUILD_DIR = '/build';
/**
 * Truffle contracts build path relative to the truffle root directory.
 */
const TRUFFLE_BUILD_CONTRACTS = path.join(TRUFFLE_BUILD_DIR, '/contracts');

/**
 * Executes the given shell command.
 */
async function exec(cmdStr) {
  let promise = new Promise(function(resolve, reject) {
    childProcess.exec(cmdStr, (err, stdout, stderr) => {
      if (err) {
        reject(stderr);
      }
      resolve(stdout);
    });
  });
  return promise;
}

/**
 * @returns true if the given file path represents a confidential contract.
 */
function isConfidential(p) {
  const filename = path.basename(p);
  return filename.startsWith('confidential_') || filename.startsWith('confidential-');
}

module.exports = {
  exec,
  isConfidential,
  CONFIDENTIAL_PREFIX,
  CONTRACTS_DIR,
  OASIS_BUILD_DIR,
  TRUFFLE_BUILD_DIR,
  TRUFFLE_BUILD_CONTRACTS
};
