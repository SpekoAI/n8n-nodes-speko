import { describe, expect, it } from 'vitest';

import { SpekoApi } from '../credentials/SpekoApi.credentials';
import { withSpekoAttribution } from '../nodes/Speko/Attribution';

const marker = 'n8n-nodes-speko/0.1.1';

describe('package attribution headers', () => {
	it('adds the package marker without changing caller headers', () => {
		const headers = Object.freeze({ Authorization: 'Bearer fixture', 'x-session-id': 'session' });
		expect(withSpekoAttribution(headers)).toEqual({ ...headers, 'User-Agent': marker });
		expect(headers).toEqual({ Authorization: 'Bearer fixture', 'x-session-id': 'session' });
	});

	it('keeps the caller User-Agent regardless of its casing', () => {
		for (const name of ['User-Agent', 'user-agent', 'uSeR-aGeNt']) {
			expect(withSpekoAttribution({ [name]: 'caller/2.0' })).toEqual({
				'User-Agent': `${marker} caller/2.0`,
			});
		}
	});

	it('normalizes duplicate casing to the last effective caller value', () => {
		expect(withSpekoAttribution({ 'User-Agent': 'first/1', 'user-agent': 'last/2' })).toEqual({
			'User-Agent': `${marker} last/2`,
		});
	});

	it('does not add the marker twice', () => {
		const first = withSpekoAttribution({ 'user-agent': 'caller/2.0' });
		expect(withSpekoAttribution(first)).toEqual(first);
	});

	it('uses the same marker in the credential test and leaves authentication unchanged', () => {
		const credentials = new SpekoApi();
		expect(credentials.test.request.headers).toEqual({ 'User-Agent': marker });
		expect(credentials.authenticate).toEqual({
			type: 'generic',
			properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
		});
	});
});
