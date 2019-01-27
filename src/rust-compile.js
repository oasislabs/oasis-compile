const assert = require('assert');
const toml = require('toml');
const path = require('path');
const truffleCompile = require('truffle-external-compile');
const fs = require('./promise-fs');
const node_fs = require('fs');
const utils = require('./utils');

/**
 * Command to compile rust source to wasm. Assumes the current directory is the top
 * level directory of the crate to build.
 */
const CARGO_BUILD_CMD = 'cargo build --release --target wasm32-unknown-unknown';
/**
 * Command to prepare wasm for execution in the Oasis runtime.
 */
const WASM_BUILD_CMD = 'wasm-build --target wasm32-unknown-unknown';
/**
 * Path to target directory, relative to the top level of a given crate.
 */
const CARGO_TARGET_DIR = './target';
/**
 * Directory (within a crate) to hold the compiled wasm output.
 */
const WASM_OUT_DIR = ".oasis-wasm";

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
  const cargoToml = await cargoCrateToml(cratePath);
  const crateName = cargoToml.name;
  const options = wasmBuildOptionsCmd(cargoToml.options);

  const targetDir = cargoTargetDir(cratePath);
  const cmd = `${WASM_BUILD_CMD} ${targetDir} ${crateName} ${options} --final oasis`;
  await utils.exec(cmd);

  // Now move out both the compiled wasm and the ABI to live within the crate.
  // This isn't strictly necessary but it's helpful for usability., because it
  // allows us to assert that only 1 .wasm file exists (see readBytecode function).
  // As a result, we can remind the user to run the clean command if needed, say,
  // if the user changed the contract's name.
  let fromPath = path.join(cargoTargetDir(cratePath), 'oasis.wasm');
  let toPath = path.join(await wasmOutDir(cratePath), 'oasis.wasm');
  let mvCmd = `mv ${fromPath} ${toPath}`;

  await fs.mkdirIfNeeded(await wasmOutDir(cratePath));
  await utils.exec(mvCmd);

  // Now move out the generated json directory to live in the crate's wasm output.
  let jsonPath = targetDir;
  if (process.env.CARGO_TARGET_DIR) {
	// Building with CARGO_TARGET_DIR set makes an extra target directory.
	jsonPath = path.join(jsonPath, 'target/json');
  } else {
	jsonPath = path.join(jsonPath, 'json');
  }

  let mvJsonCmd = `mv ${jsonPath} ${await wasmOutDir(cratePath)}`;
  await utils.exec(mvJsonCmd);
}

/**
 * @returns the directory to hold compiled wasm and its abi.
 */
async function wasmOutDir(cratePath) {
  const cargoToml = await cargoCrateToml(cratePath);
  const crateName = cargoToml.name;
  return path.join(cargoTargetDir(cratePath), crateName);
}

async function readBytecode(cratePath) {
  const parentDir = await wasmOutDir(cratePath);
  const files = await fs.readDir(parentDir);
  const wasmFiles = files.filter((name) => path.extname(name) === '.wasm');
  if (wasmFiles.length > 1) {
    throw 'Found more than one .wasm file. Execute `oasis-compile clean` and try again.'
  } else if (wasmFiles == 0) {
    throw 'Error: did not find a .wasm output.'
  }
  const wasmPath = path.join(parentDir, wasmFiles[0]);
  const hex = await fs.readBytesAsHex(wasmPath);
  return hex;
}

async function readAbi(cratePath) {
  const jsonDir =  path.join(await wasmOutDir(cratePath), 'json');
  const files = await fs.readDir(jsonDir);
  let abiName = null;
  let abi = null;
  if (files.length == 0) {
    abiName = cargoCrateToml(cratePath).name;
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

/**
 * @returns an Object with members `name` representing the crate name
 *          and `options`, representing wasm-build options, where the
 *          `options` map option-name to value.
 */
async function cargoCrateToml(crate) {
  const tomlPath = path.join(crate, 'Cargo.toml');
  const fileStr = await fs.readFile(tomlPath, 'utf8');
  return cargoCrateTomlStr(fileStr);
}

/**
 * @param fileStr is a String representing the contents of a Cargo.toml.
 */
function cargoCrateTomlStr(fileStr) {
  const data = toml.parse(fileStr);
  assertCrateNameIsValid(data.package.name);
  let options = {};
  if (data.package.metadata !== undefined) {
    options = data.package.metadata.oasis;
  }
  return {name: data.package.name, options};
}

/**
 * @returns a string representing the shell cmd options for wasm-build,
 *          e.g., --max-mem 3000
 */
function wasmBuildOptionsCmd(options) {
  if (options === undefined) {
    return '';
  }
  let cmd = '';
  if (options['max-mem'] !== undefined) {
    cmd += '--max-mem ' + options['max-mem'];
  }
  return cmd;
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
  if (process.env.CARGO_TARGET_DIR) {
	return process.env.CARGO_TARGET_DIR;
  }
  return path.join(cratePath, CARGO_TARGET_DIR);
}

module.exports = {
  cargoTargetDir,
  compile,
  findCrates,
  wasmOutDir,
  private: {
    assertCrateNameIsValid,
    cargoCrateTomlStr,
    wasmBuildOptionsCmd
  }
};
