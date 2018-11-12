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
});
