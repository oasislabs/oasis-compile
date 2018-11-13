# Oasis Compile

[![CircleCI](https://circleci.com/gh/oasislabs/oasis-compile.svg?style=svg&circle-token=7a42a176ac6ffdeebd1077bc6fdec7da5c614b87)](https://circleci.com/gh/oasislabs/oasis-compile)

Oasis-compile is a truffle compiler extension used to compile both Solidity
and Rust contracts with or without confidentiality. It is expected to run
within the context of the Oasis Contract-Kit, particularly for the use of
compiling Rust contracts.

## USAGE:

```
oasis-compile [command?]
```

### COMMANDS:

* **default** compiles all Solidity and Rust contracts in contracts/ outputing artifacts to `.oasis-build/`.
* **clean** removes all compiled output from truffle and oasis-compile.

To ensure your contracts are properly compiled, place them in the `contracts/` directory, relative to the root of your truffle project. For Rust, this includes your contract crate.

To compile your contracts with confidentiality, prepending `b'\0enc'` to a contract's bytecode, name either your solidity contract or rust crate directory of the form `confidential_*` or `confidential-*`. For example, `confidential_MyContract.sol` or `confidential-my-rust-contract`.

To integrate this into your truffle project, npm install the package and add the following to your `truffle-config.js`:

```javascript
compilers: {
    external: {
        command: "./node_modules/.bin/oasis-compile",
        targets: [{
            path: "./.oasis-build/*.json"
        }]
    }
}
```

For examples, see https://github.com/oasislabs/oasis-box.
