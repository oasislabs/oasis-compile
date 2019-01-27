#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('./promise-fs');
const node_fs = require('fs');
const path = require('path');
const rust = require('./rust-compile');
const solidity = require('./solidity-compile');
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
  console.log(chalk.green('Cleaning Oasis build...'));
  // cargo target directory
  await cleanCrates();
  // oasis-compile intermediate representation
  await fs.rmDir(await fs.trufflePath(utils.OASIS_BUILD_DIR));
  // truffle compile artifacts
  await fs.rmDir(await fs.trufflePath(utils.TRUFFLE_BUILD_DIR));
}

/**
 * Removes the target directory for all Rust contracts.
 */
async function cleanCrates() {
  const cratePaths = await rust.findCrates();
  for (let k = 0; k < cratePaths.length; k += 1) {
    const cargoLock = path.join(cratePaths[k], 'Cargo.lock');
    if (node_fs.existsSync(cargoLock)) {
      await fs.rmFile(cargoLock);
    }
    const targetDir = rust.cargoTargetDir(cratePaths[k]);
    if (targetDir !== process.env.CARGO_TARGET_DIR
		&& node_fs.existsSync(targetDir)) {
      await fs.rmDir(targetDir);
    }
	let wasmOutDir = await rust.wasmOutDir(cratePaths[k])
	if (node_fs.existsSync(wasmOutDir)) {
	  await fs.rmDir(wasmOutDir);
	}
  }
}

async function compile() {
  console.log('Building contracts for Oasis');
  fs.mkdirIfNeeded(await fs.trufflePath(utils.OASIS_BUILD_DIR));
  try {
    await Promise.all([
      rust.compile(),
      solidity.compile()
    ]);
  } catch (e) {
    console.error(chalk.red('Failed to compile'));
    console.error(e);
    throw e;
  }
}

main().catch(err => {
  console.error(chalk.red('Shutting down due to failure: ' + err));
  process.exit(1);
});
