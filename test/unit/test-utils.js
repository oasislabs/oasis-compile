const assert = require('assert');
const utils = require('../../src/utils');

describe('Utils', () => {
  it('should identiify a confidential path', () => {
	assert.equal(true, utils.isConfidential("/test/confidential_Contract.sol"));
  });
});
