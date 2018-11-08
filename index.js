#!/usr/bin/env node

const rust = require('./rust-compile');
const solidity = require("./solidity-compile");
const fs = require('./promise-fs');
const utils = require('./utils');

/**
 * Oasis-compile is a truffle compiler extension used to compile both Solidity
 * and Rust contracts with or without confidentiality.
 *
 * USAGE:
 *   oasis-compile [command?]
 *
 * COMMANDS:
 *   default      compiles all Solidity and Rust contracts in contracts/ outputing
 *                artifacts to .oasis-build/.
 *   clean        removes all compiled output from truffle and oasis-compile
 *
 * To ensure your contracts are properly compiled, place them in the contracts/
 * directory, relative to the root of your truffle project. For Rust, this
 * includes your contract crate.
 *
 * To compile your contracts with confidentiality, prepending b'\0enc' to a
 * contract's bytecode, name either your solidity contract or rust crate
 * directory of the form confidential_* or confidential-*. For example,
 * confidential_MyContract.sol or confidential-my-rust-contract.
 *
 * To integrate this into your truffle project, npm install the package and
 * add the following to your `truffle-config.js`:
 *
 * compilers: {
 *   external: {
 *     command: "./node_modules/.bin/oasis-compile",
 *     targets: [{
 *       path: "./.oasis-build/*.json"
 *     }]
 *   }
 * }
 *
 * For examples, see https://github.com/oasislabs/oasis-box.
 */
async function main() {
  if (process.argv[2] == 'clean') {
    await clean();
  } else {
    await compile();
  }
}

/**
 * Removes all compiled output from truffle and oasis-compile.
 */
async function clean() {
  console.log('Cleaning Oasis build...');
  // cargo target directory
  await cleanCrates();
  // oasis-compile intermediate representation
  await fs.rmDir(utils.OASIS_BUILD_DIR);
  // truffle compile artifacts
  await fs.rmDir(await fs.trufflePath(utils.TRUFFLE_BUILD_DIR));
}

/**
 * Removes the target directory for all Rust contracts.
 */
async function cleanCrates() {
  const cratePaths = await rust.findCrates();
  for (let k = 0; k < cratePaths.length; k += 1) {
    await fs.rmDir(rust.cargoTargetDir(cratePaths[k]));
  }
}

async function compile() {
  fs.mkdirIfNeeded(await fs.trufflePath(utils.OASIS_BUILD_DIR));
  await rust.compile();
  await solidity.compile();
}

main();
