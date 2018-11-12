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

async function main() {
  try {
    await fs.rmDir(TMP_DIR);
    await fs.mkdirIfNeeded(TMP_DIR);
    process.chdir(TMP_DIR);
    await utils.exec(CLONE_OASIS_BOX);
    process.chdir(OASIS_BOX_DIR);
    await utils.exec(OASIS_COMPILE_CMD);
    await compareCompiledOutput();
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
  // truffle's byte code changes for the last 34-2 bytes
  // i.e., bytecode = 0x || ... || these 32 bytes are different || last 2 bytes
  // so check everything except for those.
  // see https://solidity.readthedocs.io/en/develop/metadata.html#encoding-of-the-metadata-hash-in-the-bytecode
  assert.equal(
    file1.bytecode.substring(0, file1.bytecode.length - 64 - 4),
    file2.bytecode.substring(0, file2.bytecode.length - 64 - 4)
  );
  assert.equal(file1.bytecode.length, file2.bytecode.length);
  assert.equal(
    file1.bytecode.substr(file1.bytecode.length-4),
    file2.bytecode.substr(file2.bytecode.length-4)
  );
}


module.exports = main;
