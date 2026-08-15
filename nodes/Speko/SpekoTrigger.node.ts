import type {
	IDataObject,
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { spekoApiRequest } from './GenericFunctions';

export class SpekoTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Speko Trigger',
		name: 'spekoTrigger',
		icon: 'file:speko.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when a Speko call event arrives',
		defaults: {
			name: 'Speko Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'spekoApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['call.report'],
				options: [
					{
						name: 'Call Analysis',
						value: 'call.analysis',
						description: 'Post-call analysis is ready',
					},
					{
						name: 'Call Pre-Call',
						value: 'call.pre_call',
						description: 'A call is about to start',
					},
					{
						name: 'Call Recording',
						value: 'call.recording',
						description: 'A call recording is ready to download',
					},
					{
						name: 'Call Report',
						value: 'call.report',
						description: 'A call finished and its report is ready',
					},
					{
						name: 'Call Status',
						value: 'call.status',
						description: 'A call changed status, for example ringing or answered',
					},
				],
				description:
					'Which Speko events start this workflow. call.report is the durable one — failed deliveries are retried on a backoff.',
			},
			{
				displayName: 'Agent Names or IDs',
				name: 'agentIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getAgents',
				},
				default: [],
				description:
					'Only fire for these agents. Leave empty for every agent in the workspace. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	};

	methods = {
		loadOptions: {
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

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (!webhookData.webhookId) return false;

				try {
					await spekoApiRequest.call(
						this,
						'GET',
						`/v1/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
					);
					return true;
				} catch {
					// The endpoint was deleted in the Speko console; forget the stale ID
					// so `create` runs again instead of leaving the trigger dead.
					delete webhookData.webhookId;
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const agentIds = this.getNodeParameter('agentIds', []) as string[];

				const body: IDataObject = {
					name: `n8n — ${this.getWorkflow().name ?? 'Speko Trigger'}`,
					url: webhookUrl,
					events,
					allAgents: agentIds.length === 0,
				};

				if (agentIds.length > 0) body.agentIds = agentIds;

				const endpoint = (await spekoApiRequest.call(this, 'POST', '/v1/webhooks', body)) as {
					id?: string;
				};

				if (!endpoint?.id) return false;

				this.getWorkflowStaticData('node').webhookId = endpoint.id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (!webhookData.webhookId) return true;

				try {
					await spekoApiRequest.call(
						this,
						'DELETE',
						`/v1/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
					);
				} catch {
					return false;
				}

				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(body as IDataObject)],
		};
	}
}
