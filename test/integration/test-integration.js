/* globals describe,it */

const assert = require('assert');
const oasisBox = require('./oasis-box/oasis-box');

describe('Integration tests', () => {
  it('should compile the oasis-box examples', async () => {
    try {
      await oasisBox();
    } catch (err) {
      assert.equal(true, false);
    }
  }).timeout(500000); // rust compiler is slow :/
});
