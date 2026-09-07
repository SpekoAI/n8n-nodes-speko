const assert = require('node:assert/strict');
const manifest = require('../package.json');
const { Speko } = require('../dist/nodes/Speko/Speko.node.js');
const { SpekoApi } = require('../dist/credentials/SpekoApi.credentials.js');
const { spekoApiRequest } = require('../dist/nodes/Speko/GenericFunctions.js');

const expected = `${manifest.name}/${manifest.version}`;
const calls = [];
const context = {
	getInputData: () => [{ json: {} }],
	getNodeParameter: (name) => ({ resource: 'agent', operation: 'getAll' })[name],
	helpers: {
		async httpRequestWithAuthentication(credentials, request) {
			assert.equal(credentials, 'spekoApi');
			calls.push(request);
			return [];
		},
	},
};

async function main() {
	await new Speko().execute.call(context);
	assert.equal(calls[0].headers['User-Agent'], expected,
		'Package User-Agent must match package.json before publication');
	assert.equal(calls[0].url, 'https://api.speko.dev/v1/agents');
	await spekoApiRequest.call(context, 'GET', '/v1/agents', {}, {}, {
		headers: { 'uSeR-aGeNt': 'caller/2.0', 'x-custom': 'preserved' },
	});
	assert.equal(calls[1].headers['User-Agent'], `${expected} caller/2.0`);
	assert.equal(calls[1].headers['x-custom'], 'preserved');
	assert.equal(calls.length, 2);
	const credentials = new SpekoApi();
	assert.equal(credentials.test.request.headers['User-Agent'], expected);
	console.log(`Package version check passed for ${expected}: native action, caller headers, credential test.`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
