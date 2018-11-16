const assert = require('assert');
const toml = require('toml');
const path = require('path');
const truffleCompile = require('truffle-external-compile');
const fs = require('./promise-fs');
const utils = require('./utils');

/**
 * Command to compile rust source to wasm. Assumes the current directory is the top
 * level directory of the crate to build.
 */
const CARGO_BUILD_CMD = 'cargo build --target-dir ./target --release --target wasm32-unknown-unknown';
/**
 * Command to prepare wasm for execution in the Oasis runtime.
 */
const WASM_BUILD_CMD = 'wasm-build --target wasm32-unknown-unknown';
/**
 * Path to target directory, relative to the top level of a given crate.
 */
const CARGO_TARGET_DIR = 'target';

/**
 * Compiles all crates representing contracts in the truffle project's contracts/.
 */
async function compile() {
  process.chdir(await fs.trufflePath(utils.CONTRACTS_DIR));
  const crates = await findCrates();
  const builds = [];
  for (let k = 0; k < crates.length; k += 1) {
    builds.push(buildContract(crates[k]));
  }
  await Promise.all(builds);
}

/**
 * @returns an array of paths from the current directory to a rust-crate
 *          representing a WASM contract. Paths are of the form "./path/crate".
 */
async function findCrates() {
  const contractsPath = await fs.trufflePath(utils.CONTRACTS_DIR);
  const fileToFind = 'Cargo.toml';
  return await fs.findDirectories(contractsPath, fileToFind);

}

async function buildContract(cratePath) {
  const crateName = fs.basename(cratePath);

  utils.logCompileStart(crateName);

  process.chdir(cratePath);

  await cargoBuild();
  await wasmBuild(cratePath);

  let bytecode = await readBytecode(cratePath);

  if (utils.isConfidential(crateName)) {
    bytecode = utils.CONFIDENTIAL_PREFIX + bytecode.substr(2);
  }
  const [abiFilename, abi] = await readAbi(cratePath);

  await fs.writeArtifact({
    contractName: contractName(abiFilename),
    abi,
    bytecode
  });
}

/**
 * @returns the contract name from the name of an abi json file.
 *          Strips off .json at the end of the filename.
 */
function contractName(abiFilename) {
  if (!abiFilename.endsWith('.json')) {
    throw 'Filename must end with .json';
  }
  return abiFilename.substring(0, abiFilename.length - '.json'.length);
}

/**
 * Assumes the current directory is the top level directory of the given crate.
 * Compiles the crate to wasm.
 */
async function cargoBuild() {
  await utils.exec(CARGO_BUILD_CMD);
}

/**
 * Assumes the current directory is the top level directory of the given crate.
 * Transforms the already compiled wasm to wasm usable by the Oasis runtime.
 *
 * Note: we need to know the crate name at this point. As a result, we force the
 *       constraint that the crate's filename (i.e. the basename of cratePath) is
 *       the actual name of the crate--ignoring the confidential prefix.
 */
async function wasmBuild(cratePath) {
  const crateName = await cargoCrateName(cratePath);
  const targetPath = path.join(cratePath, CARGO_TARGET_DIR);
  const cmd = `${WASM_BUILD_CMD} ${targetPath} ${crateName}`;
  await utils.exec(cmd);
}

async function readBytecode(cratePath) {
  const targetDir =  path.join(cratePath, CARGO_TARGET_DIR);
  const files = await fs.readDir(targetDir);
  const wasmFiles = files.filter((name) => path.extname(name) === '.wasm');
  if (wasmFiles.length > 1) {
    throw 'Found more than one .wasm file. Execute `oasis-compile clean` and try again.'
  } else if (wasmFiles == 0) {
    throw 'Error: did not find a .wasm output.'
  }
  const wasmPath = path.join(targetDir, wasmFiles[0]);
  const hex = await fs.readBytesAsHex(wasmPath);
  return hex;
}

async function readAbi(cratePath) {
  const jsonDir =  path.join(cratePath, CARGO_TARGET_DIR, 'json');
  const files = await fs.readDir(jsonDir);
  let abiName = null;
  let abi = null;
  if (files.length == 0) {
    abiName = cargoCrateName(cratePath);
    abi = truffleCompile.DEFAULT_ABI;
  } else {
    if (files.length > 1) {
      throw new Error('There can be only one ABI per Rust contract crate. Execute `oasis-compile clean` and try again.')
    }
    abiName = files[0];
    assert.equal(abiName.endsWith('.json'), true);
    abi = JSON.parse(await fs.readFile(path.join(jsonDir, abiName), 'utf8'));
  }
  return [abiName, abi];
}

async function cargoCrateName(crate) {
  const tomlPath = path.join(crate, 'Cargo.toml');
  const fileStr = await fs.readFile(tomlPath, 'utf8');
  const data = toml.parse(fileStr);
  assertCrateNameIsValid(data.package.name);
  return data.package.name;
}

/**
 * @throws exception if the given crate name is invalid.
 */
function assertCrateNameIsValid(crateNameStr) {
  const validCrateNameRegex = /^[a-zA-Z]+[-_a-zA-Z0-9]*$/;
  if (!validCrateNameRegex.test(crateNameStr)) {
    throw `Invalid crate name: ${crateNameStr}. Crates must contain only alphanumeric characters separated by a - or _.`
  }
}

/**
 * @assumes {String} cratePath is the path to the top level of a crate.
 * @returns {String} the path to that crates cargo target directory.
 */
function cargoTargetDir(cratePath) {
  return path.join(cratePath, CARGO_TARGET_DIR);
}

module.exports = {
  cargoTargetDir,
  compile,
  findCrates,
  private: {
    assertCrateNameIsValid
  }
};
