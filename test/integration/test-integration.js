#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('../../src/promise-fs');

const assert = require('assert');
const utils = require('../../src/utils');

const oasisBox = require('./oasis-box/oasis-box');

describe('Integration tests', () => {
  it('should compile the oasis-box examples', async () => {
	try {
	  await oasisBox();
	} catch (err) {
	  assert.equal(true, false);
	}
  }).timeout(5000);
});
