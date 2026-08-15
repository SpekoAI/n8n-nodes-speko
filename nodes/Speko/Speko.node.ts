import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	flattenTranscript,
	mimeTypeToExtension,
	parseTranscribeStream,
	spekoApiRequest,
	type TranscriptTurn,
} from './GenericFunctions';

export class Speko implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Speko',
		name: 'speko',
		icon: 'file:speko.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Place voice-agent phone calls, read transcripts, and convert speech',
		defaults: {
			name: 'Speko',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'spekoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Agent',
						value: 'agent',
					},
					{
						name: 'Call',
						value: 'call',
					},
					{
						name: 'Speech',
						value: 'speech',
					},
				],
				default: 'call',
			},

			// ----------------------------------- Call
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['call'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Look up a call — status, duration, and outcome',
						action: 'Get a call',
					},
					{
						name: 'Get Recording',
						value: 'getRecording',
						description: 'Download the audio recording of a call',
						action: 'Get a call recording',
					},
					{
						name: 'Get Transcript',
						value: 'getTranscript',
						description: 'Fetch the full transcript of a call',
						action: 'Get a call transcript',
					},
					{
						name: 'Place',
						value: 'place',
						description: 'Call a phone number and run one of your voice agents on the line',
						action: 'Place an outbound call',
					},
				],
				default: 'place',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '+12015551234',
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['place'],
					},
				},
				description:
					'The number to call, in E.164 format — country code included, no spaces or dashes',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAgents',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['place'],
					},
				},
				description:
					'The voice agent that runs the conversation. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['place'],
					},
				},
				options: [
					{
						displayName: 'Caller ID',
						name: 'from',
						type: 'string',
						default: '',
						placeholder: '+12015550100',
						description:
							'A number you own in Speko, in E.164 format. Leave blank to use your workspace default.',
					},
					{
						displayName: 'First Message',
						name: 'firstMessage',
						type: 'string',
						default: '',
						description: 'Overrides the agent\'s opening line for this call only',
					},
					{
						displayName: 'Maximum Duration (Seconds)',
						name: 'maxDurationSeconds',
						type: 'number',
						default: 600,
						description: 'Hard cap on call length. Clamped to between 30 seconds and 4 hours.',
					},
					{
						displayName: 'Prompt Variables',
						name: 'variables',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Values for {{placeholders}} in the agent prompt, for example customer → Mr. Lee.',
						options: [
							{
								name: 'variable',
								displayName: 'Variable',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
									},
								],
							},
						],
					},
				],
			},
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['get', 'getRecording'],
					},
				},
				description:
					'The Session ID returned by Place Outbound Call. Speko accepts the same ID for calls and sessions.',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['getTranscript'],
					},
				},
				description: 'The Session ID returned by Place Outbound Call or by the Speko Trigger',
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: {
						resource: ['call'],
						operation: ['getRecording'],
					},
				},
				description: 'The name of the output binary field to put the recording in',
			},

			// ----------------------------------- Agent
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['agent'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get one voice agent',
						action: 'Get an agent',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the voice agents in your workspace',
						action: 'Get many agents',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'agentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAgents',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['get'],
					},
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},

			// ----------------------------------- Speech
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['speech'],
					},
				},
				options: [
					{
						name: 'Synthesize',
						value: 'synthesize',
						description: 'Turn text into speech audio',
						action: 'Synthesize speech',
					},
					{
						name: 'Transcribe',
						value: 'transcribe',
						description: 'Turn an audio file into text',
						action: 'Transcribe audio',
					},
				],
				default: 'synthesize',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				required: true,
				default: '',
				typeOptions: {
					rows: 3,
				},
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				description: 'The text to speak, up to 50,000 characters',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				required: true,
				default: 'en-US',
				placeholder: 'en-US',
				displayOptions: {
					show: {
						resource: ['speech'],
					},
				},
				description:
					'BCP-47 language tag, for example en, en-US, or es-MX. Speko routes to the best provider for it.',
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['synthesize'],
					},
				},
				description: 'The name of the output binary field to put the audio in',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: {
						resource: ['speech'],
						operation: ['transcribe'],
					},
				},
				description: 'The name of the input binary field containing the audio to transcribe',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['speech'],
					},
				},
				options: [
					{
						displayName: 'Keywords',
						name: 'keywords',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								'/operation': ['transcribe'],
							},
						},
						description:
							'Comma-separated words the transcriber should expect, for example product or person names',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								'/operation': ['synthesize'],
							},
						},
						description:
							'Upstream model name, for example eleven_multilingual_v2. Leave blank to let Speko choose.',
					},
					{
						displayName: 'Optimize For',
						name: 'optimizeFor',
						type: 'options',
						default: 'balanced',
						options: [
							{
								name: 'Accuracy',
								value: 'accuracy',
							},
							{
								name: 'Balanced',
								value: 'balanced',
							},
							{
								name: 'Cost',
								value: 'cost',
							},
							{
								name: 'Latency',
								value: 'latency',
							},
						],
						description: 'Which axis Speko should favour when it picks a provider',
					},
					{
						displayName: 'Region',
						name: 'region',
						type: 'options',
						default: 'global',
						options: [
							{
								name: 'Asia Southeast 1',
								value: 'asia-southeast1',
							},
							{
								name: 'Europe West 3',
								value: 'europe-west3',
							},
							{
								name: 'Global',
								value: 'global',
							},
							{
								name: 'US East 4',
								value: 'us-east4',
							},
						],
						description: 'Region whose latency measurements should drive the choice',
					},
					{
						displayName: 'Speed',
						name: 'speed',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 0.5,
							maxValue: 2,
						},
						displayOptions: {
							show: {
								'/operation': ['synthesize'],
							},
						},
						description: 'Playback rate between 0.5 and 2',
					},
					{
						displayName: 'Voice',
						name: 'voice',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								'/operation': ['synthesize'],
							},
						},
						description:
							'Provider-specific voice ID. Leave blank for a sane default in the chosen language.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			// Users pick an agent by name; the opaque agent_… ID never has to be pasted.
			async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const agents = (await spekoApiRequest.call(this, 'GET', '/v1/agents')) as Array<{
					id: string;
					name?: string;
				}>;

				return (agents ?? []).map((agent) => ({
					name: agent.name || agent.id,
					value: agent.id,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'call' && operation === 'place') {
					const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

					const body: IDataObject = {
						to: this.getNodeParameter('to', i) as string,
						agentId: this.getNodeParameter('agentId', i) as string,
					};

					if (additionalFields.from) body.from = additionalFields.from;
					if (additionalFields.firstMessage) body.firstMessage = additionalFields.firstMessage;
					if (additionalFields.maxDurationSeconds) {
						body.maxDurationSeconds = additionalFields.maxDurationSeconds;
					}

					// Sending `variables` at all switches the agent prompt into template
					// mode, so the key only goes out when the user supplied pairs.
					const pairs = ((additionalFields.variables as IDataObject)?.variable ??
						[]) as Array<{ name: string; value: string }>;
					if (pairs.length > 0) {
						body.variables = pairs.reduce<IDataObject>((acc, pair) => {
							if (pair.name) acc[pair.name] = pair.value;
							return acc;
						}, {});
					}

					const response = await spekoApiRequest.call(this, 'POST', '/v1/sessions/phone', body);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'call' && operation === 'get') {
					const callId = this.getNodeParameter('callId', i) as string;
					const response = await spekoApiRequest.call(
						this,
						'GET',
						`/v1/calls/${encodeURIComponent(callId)}`,
					);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'call' && operation === 'getTranscript') {
					const sessionId = this.getNodeParameter('sessionId', i) as string;
					const transcript = (await spekoApiRequest.call(
						this,
						'GET',
						`/v1/sessions/${encodeURIComponent(sessionId)}/transcript`,
					)) as { turns?: TranscriptTurn[] };

					returnData.push({
						json: {
							id: sessionId,
							...transcript,
							text: flattenTranscript(transcript?.turns ?? []),
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (resource === 'call' && operation === 'getRecording') {
					const callId = this.getNodeParameter('callId', i) as string;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

					const response = (await spekoApiRequest.call(
						this,
						'GET',
						`/v1/calls/${encodeURIComponent(callId)}/recording`,
						{},
						{},
						{ encoding: 'arraybuffer', returnFullResponse: true },
					)) as { body: Buffer; headers: Record<string, string> };

					const mimeType = response.headers?.['content-type'] ?? 'audio/mpeg';

					returnData.push({
						json: { callId },
						binary: {
							[binaryPropertyName]: await this.helpers.prepareBinaryData(
								Buffer.from(response.body),
								`${callId}.${mimeTypeToExtension(mimeType)}`,
								mimeType,
							),
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (resource === 'agent' && operation === 'getAll') {
					const agents = (await spekoApiRequest.call(this, 'GET', '/v1/agents')) as IDataObject[];
					for (const agent of agents ?? []) {
						returnData.push({ json: agent, pairedItem: { item: i } });
					}
					continue;
				}

				if (resource === 'agent' && operation === 'get') {
					const agentId = this.getNodeParameter('agentId', i) as string;
					const response = await spekoApiRequest.call(
						this,
						'GET',
						`/v1/agents/${encodeURIComponent(agentId)}`,
					);
					returnData.push({ json: response as IDataObject, pairedItem: { item: i } });
					continue;
				}

				if (resource === 'speech' && operation === 'synthesize') {
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

					const intent: IDataObject = {
						language: this.getNodeParameter('language', i) as string,
					};
					if (options.region) intent.region = options.region;
					if (options.optimizeFor) intent.optimizeFor = options.optimizeFor;

					const body: IDataObject = {
						text: this.getNodeParameter('text', i) as string,
						intent,
					};
					if (options.voice) body.voice = options.voice;
					if (options.model) body.model = options.model;
					if (options.speed) body.speed = options.speed;

					const response = (await spekoApiRequest.call(
						this,
						'POST',
						'/v1/synthesize',
						body,
						{},
						{ encoding: 'arraybuffer', returnFullResponse: true },
					)) as { body: Buffer; headers: Record<string, string> };

					const mimeType = response.headers?.['content-type'] ?? 'audio/mpeg';

					returnData.push({
						json: { text: body.text, language: intent.language, mimeType },
						binary: {
							[binaryPropertyName]: await this.helpers.prepareBinaryData(
								Buffer.from(response.body),
								`speech.${mimeTypeToExtension(mimeType)}`,
								mimeType,
							),
						},
						pairedItem: { item: i },
					});
					continue;
				}

				if (resource === 'speech' && operation === 'transcribe') {
					const options = this.getNodeParameter('options', i, {}) as IDataObject;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

					const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
					const audio = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

					const intent: IDataObject = {
						language: this.getNodeParameter('language', i) as string,
					};
					if (options.region) intent.region = options.region;
					if (options.optimizeFor) intent.optimizeFor = options.optimizeFor;

					const headers: IDataObject = {
						'x-speko-intent': JSON.stringify(intent),
						'Content-Type': binaryData.mimeType || 'audio/wav',
					};

					if (options.keywords) {
						const keywords = (options.keywords as string)
							.split(',')
							.map((keyword) => keyword.trim())
							.filter(Boolean);
						if (keywords.length > 0) {
							headers['x-speko-stt-options'] = JSON.stringify({ keywords });
						}
					}

					const stream = (await spekoApiRequest.call(this, 'POST', '/v1/transcribe', {}, {}, {
						encoding: 'text',
						headers,
						rawBody: audio,
					})) as string;

					returnData.push({ json: parseTranscribeStream(stream), pairedItem: { item: i } });
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`The operation "${operation}" is not supported for the resource "${resource}"`,
					{ itemIndex: i },
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
