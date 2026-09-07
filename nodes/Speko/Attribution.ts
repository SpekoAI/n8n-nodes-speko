import type { IDataObject } from 'n8n-workflow';

const USER_AGENT = 'n8n-nodes-speko/0.1.1';

/** Keep caller headers and add the package marker once to the effective User-Agent. */
export function withSpekoAttribution(headers: IDataObject = {}): IDataObject {
	const result = { ...headers };
	let existing: IDataObject[string];
	for (const key of Object.keys(result)) {
		if (key.toLowerCase() === 'user-agent') {
			existing = result[key];
			delete result[key];
		}
	}
	const caller = existing === undefined || existing === null || existing === false
		? ''
		: Array.isArray(existing) ? existing.join(', ') : String(existing);
	result['User-Agent'] = caller.split(/\s+/).includes(USER_AGENT)
		? caller
		: caller ? `${USER_AGENT} ${caller}` : USER_AGENT;
	return result;
}
