import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SpekoApi implements ICredentialType {
	name = 'spekoApi';

	displayName = 'Speko API';

	documentationUrl = 'https://docs.speko.dev';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Speko API key. Create one at platform.speko.dev/api-keys — keys start with sk_live_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/organization is the cheapest endpoint every key can reach, so one
	// request both validates the key and proves the workspace exists.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.speko.dev',
			url: '/v1/organization',
		},
	};
}
