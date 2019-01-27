#!/usr/bin/env node

/**
 * Tests the examples in the oasis-box can be correctly compiled by cloning
 * the repo, compiling the contracts, and checking the output is what we
 * expect. See EXPECTED_OASIS_BUILD_DIR for the expected output.
 */

const assert = require('assert');
const path = require('path');
const utils = require('../../../src/utils');
const fs = require('../../../src/promise-fs');
const node_fs = require('fs');

/**
 * Command to download the truffle project that we'll compile.
 */
const CLONE_OASIS_BOX = 'git clone  https://github.com/oasislabs/oasis-box.git';
/**
 * Resultant directory after cloning the box.
 */
const OASIS_BOX_DIR = path.join(__dirname, 'tmp/oasis-box');
/**
 * Directory into which we clone the oasis-box and perform our test.
 */
const TMP_DIR = path.join(__dirname, 'tmp');
/**
 * Shell cmd for starting compilation.
 */
const OASIS_COMPILE_CMD = path.join(__dirname, '../../../src/index.js');
/**
 * Directory holding the tests expected output, i.e., the compiled contract
 * artifacts.
 */
const EXPECTED_OASIS_BUILD_DIR = path.join(__dirname, 'expected-oasis-build');
/**
 * Directory holding the resultant output from running the oasis-compile cmd
 * inside the oasis-box truffle project.
 */
const RESULTANT_OASIS_BUILD_DIR = path.join(__dirname, 'tmp/oasis-box/.oasis-build');
/**
 * Shell cmd for removing all the compiled artifacts.
 */
const OASIS_CLEAN_CMD = `${OASIS_COMPILE_CMD} clean`;

async function main() {
  try {
    // clean any old test files (not necessary but sometimes its nice to
    // keep the tmp dir around for debugging and so this is here to clean
    // up in those situations for convenience).
    await fs.rmDir(TMP_DIR);

    await testCompile();
    await testClean();

    // cleanup
    await fs.rmDir(TMP_DIR);
  } catch (err) {
    console.error('error: ', err);
    // cleanup
    await fs.rmDir(TMP_DIR);
    process.exit(1);
  }
}

/**
 * Tests the OASIS_COMPILE_CMD.
 */
async function testCompile() {
  await fs.mkdirIfNeeded(TMP_DIR);
  process.chdir(TMP_DIR);
  await utils.exec(CLONE_OASIS_BOX);
  process.chdir(OASIS_BOX_DIR);
  await utils.exec(OASIS_COMPILE_CMD);
  await compareCompiledOutput();
}

/**
 * Goes through all the compiled output of the oasis-box and compares it
 * to the expected compiled output in the `expected-oasis-build` directory.
 */
async function compareCompiledOutput() {
  const expectedFiles = await fs.readDir(EXPECTED_OASIS_BUILD_DIR);
  const resultFiles = await fs.readDir(RESULTANT_OASIS_BUILD_DIR);

  assert.equal(expectedFiles.length, resultFiles.length);
  for (let k = 0; k < expectedFiles.length; k += 1) {
    const expectedFilePath = path.join(EXPECTED_OASIS_BUILD_DIR, expectedFiles[k]);
    const resultFilePath = path.join(RESULTANT_OASIS_BUILD_DIR, expectedFiles[k]);
    await assertArtifactsEqual(expectedFilePath, resultFilePath);
  }
}

/**
 * Errors if the compiled artifacts at the given file paths are not equal;
 */
async function assertArtifactsEqual(filePath1, filePath2) {
  const file1 = JSON.parse(await fs.readFile(filePath1));
  const file2 = JSON.parse(await fs.readFile(filePath2));
  assert.equal(file1.contractName, file2.contractName);
  assert.deepEqual(file1.abi, file2.abi);
  assert.equal(file1.bytecode.length, file2.bytecode.length);
  // Don't bother checking the bytecode is exactly equal, because the
  // bytecode changes enough such that this is more of a headache than
  // its worth (since everytime we have to make a change we would need
  // to updated the expected bytecode).
}

/**
 * Tests the OASIS_CLEAN_CMD.
 */
async function testClean() {
  process.chdir(OASIS_BOX_DIR);
  // make the build directory that truffle would create for truffle compile
  // since we want to test cleaning it
  await fs.mkdirIfNeeded(path.join(OASIS_BOX_DIR, 'build'));
  await utils.exec(OASIS_CLEAN_CMD);
  await assertContractsCleaned();
  await assertOasisBuildCleaned();
  await assertTruffleBuildCleaned();
}

async function assertContractsCleaned() {
  assert.equal(
    node_fs.existsSync(path.join(OASIS_BOX_DIR, 'contracts', 'wasm-counter', 'target')),
    false
  );
  assert.equal(
    node_fs.existsSync(path.join(OASIS_BOX_DIR, 'contracts', 'confidential-wasm-counter', 'target')),
    false
  );
  assert.equal(
    node_fs.existsSync(path.join(OASIS_BOX_DIR, 'contracts', 'nested', 'nested-wasm-counter', 'target')),
    false
  );
}

async function assertOasisBuildCleaned() {
  assert.equal(node_fs.existsSync(RESULTANT_OASIS_BUILD_DIR), false);
}

async function assertTruffleBuildCleaned() {
  const truffleBuildDir = path.join(OASIS_BOX_DIR, 'build');
  assert.equal(node_fs.existsSync(truffleBuildDir), false);
}

module.exports = main;
