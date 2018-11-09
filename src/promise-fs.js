const fs = require('fs');
const findUp = require('find-up');
const path = require('path');
const utils = require('./utils');

/**
 * Promise based filesystem utilities.
 */

/**
 * Promise based version of fs.readFile.
 */
async function readFile(file, encoding) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, encoding, function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

/**
 * Promise based version of fs.readDir.
 */
async function readDir(dirPath) {
  return new Promise(function(resolve, reject) {
    fs.readdir(dirPath, function (err, files) {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
}

/**
 * Promise based version of fs.writeFile.
 */
async function writeFile(p, str) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(p, str, function (err, files) {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
}

/**
 * Makes a directory at the given path, if it doens't already exist. Otherwise
 * does nothing.
 */
function mkdirIfNeeded(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

/**
 * @returns a hex string representing the bytes inside the given file.
 */
async function readBytesAsHex(file) {
  return new Promise(function(resolve, reject) {
    fs.readFile(file, function read(err, data) {
      if (err) {
        reject(err);
      }
      let buf = Buffer.from(data);
      let bytecode = '0x' + buf.toString('hex');
      resolve(bytecode);
    });
  });
}

/**
 * Removes the directory at the given path and all of its contents.
 */
async function rmDir(p)  {
  return fs.rmdirSync(p);
}

/**
 * Removes file if it exists
 */
async function rmFile(f)  {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
  }
}

/**
 * @returns the full filesystem path relative to the truffle root directory.
 *          I.e., given a path of the form /my/path and a truffle root of
 *          the form /this/is, returns /this/is/my/path.
 */
async function trufflePath(p) {
  return path.join(await truffleRoot(), p);
}

/**
 * @returns the filesystem path to the root of the truffle project.
 *          This is the directory holding truffle-config.js
 */
async function truffleRoot() {
  const config1 = await findUp('truffle-config.js');
  const config2 = await findUp('truffle.js');
  if (config1 === null) {
    return parentDir(config2);
  } else if (config2 === null) {
    return parentDir(config1);
  } else if (config1.split(path.sep).length > config2.split(path.sep).length) {
    return parentDir(config1);
  } else {
    return parentDir(config2);
  }
}

/**
 * Given a filesystem path of the form: /a/b/c, returns /a/b
 */
async function parentDir(p) {
  return path.dirname(p);
}

function basename(p) {
  return path.basename(p);
}

/**
 * Writes the given compilation artifact to the OASIS_BUILD_DIR to
 * the file [name].json
 */
async function writeArtifact(name, artifact) {
  const buildDir = await trufflePath(utils.OASIS_BUILD_DIR);
  const p = path.join(buildDir, `${name}.json`);
  await writeFile(p, JSON.stringify(artifact, null, 2));
}


module.exports = {
  readFile,
  readDir,
  writeFile,
  mkdirIfNeeded,
  readBytesAsHex,
  rmDir,
  rmFile,
  parentDir,
  trufflePath,
  basename,
  writeArtifact
};
