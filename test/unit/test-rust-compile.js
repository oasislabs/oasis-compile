/* globals describe,it */

const assert = require('assert');
const rust = require('../../src/rust-compile');

describe('Rust', () => {
  describe('assertCrateNameIsValid', () => {
    // second item is true iff we expect the method to throw exception
    const cases = [
      // invalid crate names
      ['../my-crate', true],
      ['my-crate/../secret', true],
      ['my-crate;', true],
      [';my-crate', true],
      ['1my-crate', true],
      ['-my-crate', true],
      ['my-crate,', true],
      // valid crate names
      ['my-crate', false],
      ['my-crate-', false],
      ['my-crate-name-is-long', false],
      ['my-crate-name-is_long', false],
      ['my----crate', false],
      ['my_crate', false],
      ['MyCrate', false],
      ['MY_CRATE', false],
      ['MyCrAtE', false]
    ];

    cases.forEach((c) => {
      it(testCaseDescription(c), () => {
        let didThrow = false;
        try {
          rust.private.assertCrateNameIsValid(c[0]);
        } catch(err) {
          didThrow = true;
        }
        assert.equal(c[1], didThrow);
      });
    });

    function testCaseDescription(c) {
      let description = 'should';
      if (!c[1]) {
        description += ' not';
      }
      return description + ' throw exception for a crate name of the form ' + c[0];
    }
  });

  describe('cargoCrateToml', () => {
    const cases = [
      {
        description: 'should return an object with {} options when there is no metadata',
        toml: `[package]
               name = "wasm-counter"
               version = "0.1.0"
               authors = ["Oasis Labs Inc. <info@oasislabs.com>"]`,
        expected: { name: 'wasm-counter', options: {} }
      },
      {
        description: 'should return an object with {} options when there is empty metadata',
        toml: `[package]
               name = "wasm-counter"
               version = "0.1.0"
               authors = ["Oasis Labs Inc. <info@oasislabs.com>"]

               [package.metadata.oasis]`,
        expected: { name: 'wasm-counter', options: {} }
      },
      {
        description: 'should return an object with max-mem options when there is metadata',
        toml: `[package]
               name = "wasm-counter"
               version = "0.1.0"
               authors = ["Oasis Labs Inc. <info@oasislabs.com>"]

               [package.metadata.oasis]
               max-mem = 30000`,
        expected: { name: 'wasm-counter', options: { 'max-mem': 30000 } }
      }
    ];
    cases.forEach((testCase) => {
      it(testCase.description, () => {
        let result = rust.private.cargoCrateTomlStr(testCase.toml);
        assert.deepEqual(result, testCase.expected);
      });
    });
  });

  describe('wasmBuildOptionsCmd', () => {
    const cases = [
      {
        description: 'should give empty options when undefined options are given',
        options: undefined,
        expected: ''
      },
      {
        description: 'should give empty options when options are given with undefined max-mem',
        options: {},
        expected: ''
      },
      {
        description: 'should give empty options when options are given with invalid options',
        options: {'not-valid': 30000},
        expected: ''
      },
      {
        description: 'should give empty options when options are given with max-mem == 30000',
        options: {'max-mem': 30000},
        expected: '--max-mem 30000'
      },
    ];
    cases.forEach((testCase) => {
      it(testCase.description, () => {
        let result = rust.private.wasmBuildOptionsCmd(testCase.options);
        assert.equal(result, testCase.expected);
      });
    });
  });
});
