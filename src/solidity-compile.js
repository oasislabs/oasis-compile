const truffleCompile = require('truffle-compile');
const Resolver = require('truffle-resolver');
const fs = require('./promise-fs');
const utils = require('./utils');
const Web3c = require('web3c');
const web3c = new Web3c();

async function compile() {
  truffleCompile.all(await compileConfig(), (err, contracts) => {
    if (err) {
      throw new Error('Could not compile contracts:' + err);
    }
    Object.keys(contracts).forEach((contractName) => {
      let contract = contracts[contractName];
      utils.logCompileStart(fs.basename(contract.sourcePath));
      if (utils.isConfidential(contract.sourcePath)) {
        contract = confidentialCompile(contract);
      }
      contract = sanitize(contract);
      fs.writeArtifact(contract);
    });
  });
}

async function compileConfig() {
  return {
    resolver: new Resolver({
      working_directory: await fs.trufflePath('oasis-compile'),
      contracts_directory: await fs.trufflePath(utils.CONTRACTS_DIR),
      contracts_build_directory: await fs.trufflePath(utils.TRUFFLE_BUILD_CONTRACTS),
    }),
    working_directory: await fs.trufflePath('oasis-compile'),
    contracts_directory: await fs.trufflePath(utils.CONTRACTS_DIR),
    quiet: true,
    strict: false,
    paths: await fs.trufflePath(utils.CONTRACTS_DIR),
    solc: true,
  };
}

/**
 * @returns a contract artifact where the bytecode is prepended with the
 *          confidential prefix.
 * @param   {Object} contract is a contract artifact, i.e., the output of truffle
 *          compile.
 */
function confidentialCompile(contract) {
  contract.bytecode = web3c.oasis.utils.DeployHeader.deployCode({confidential: true}, contract.bytecode);
  contract.deployedBytecode = web3c.oasis.utils.DeployHeader.deployCode({confidential: true}, contract.deployedBytecode);
  return contract;
}

/**
 * Mutates the given compiled contract, removing unecessary properties so that
 * truffle's external compilation validates properly.
 */
function sanitize(contract) {
  contract.contractName = contract.contract_name;
  // delete so truffle doesn't complain about additional data
  delete contract.contract_name;
  delete contract.unlinked_binary;

  return contract;
}

module.exports = {
  compile
}
