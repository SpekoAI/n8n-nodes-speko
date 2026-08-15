import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const SPEKO_BASE_URL = 'https://api.speko.dev';

export const CREDENTIAL_NAME = 'spekoApi';

type SpekoContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

interface SpekoRequestOptions {
	/** Extra headers merged on top of the authenticated defaults. */
	headers?: IDataObject;
	/** `arraybuffer` for audio downloads, `text` for SSE streams. */
	encoding?: 'arraybuffer' | 'text';
	/** Raw (non-JSON) request body, e.g. audio bytes for /v1/transcribe. */
	rawBody?: Buffer;
	/** Return `{ body, headers, statusCode }` so callers can read content-type. */
	returnFullResponse?: boolean;
}

/**
 * Audio endpoints answer with whatever format the chosen provider produced, so
 * the binary field is stamped from the response header rather than assumed.
 */
export function mimeTypeToExtension(mimeType: string): string {
	const subtype = mimeType.split(';')[0].trim().split('/')[1] ?? 'mp3';

	const known: Record<string, string> = {
		mpeg: 'mp3',
		mp3: 'mp3',
		wav: 'wav',
		'x-wav': 'wav',
		wave: 'wav',
		ogg: 'ogg',
		opus: 'opus',
		webm: 'webm',
		flac: 'flac',
		aac: 'aac',
		'l16': 'pcm',
		pcm: 'pcm',
	};

	return known[subtype] ?? 'mp3';
}

/**
 * Speko returns `{ error, code }` on every failure. Surfacing that sentence
 * beats letting n8n print a bare status code, because the API already writes
 * messages that name the fix.
 */
function describeError(error: unknown): string | undefined {
	const httpCode = (error as { httpCode?: string | number })?.httpCode;
	const status = Number(httpCode);

	if (status === 401) {
		return 'That API key was rejected. Copy a current key from platform.speko.dev/api-keys.';
	}

	if (status === 402) {
		return 'This Speko workspace is out of credits, so the request was not carried out. Top up at platform.speko.dev.';
	}

	const body = (error as { cause?: { error?: string } })?.cause;
	if (body?.error) return body.error;

	const nested = (error as { response?: { body?: { error?: string } } })?.response?.body;
	if (nested?.error) return nested.error;

	return undefined;
}

export async function spekoApiRequest(
	this: SpekoContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: SpekoRequestOptions = {},
): Promise<any> {
	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${SPEKO_BASE_URL}${endpoint}`,
		qs,
		headers: { ...(options.headers ?? {}) },
		json: options.encoding === undefined,
	};

	if (options.rawBody !== undefined) {
		requestOptions.body = options.rawBody;
	} else if (Object.keys(body).length > 0) {
		requestOptions.body = body;
	}

	if (options.encoding === 'arraybuffer') {
		requestOptions.encoding = 'arraybuffer';
	} else if (options.encoding === 'text') {
		requestOptions.encoding = 'text';
	}

	if (options.returnFullResponse) {
		requestOptions.returnFullResponse = true;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_NAME,
			requestOptions,
		);
	} catch (error) {
		const message = describeError(error);
		throw new NodeApiError(this.getNode(), error as JsonObject, message ? { message } : undefined);
	}
}

export interface TranscriptTurn {
	index?: number;
	source: string;
	text: string;
}

/**
 * The common downstream use of a transcript is pasting the whole conversation
 * into an email or a doc, so the node ships a flattened string alongside the
 * turns rather than making every user build it with a Code node.
 */
export function flattenTranscript(turns: TranscriptTurn[] = []): string {
	return turns.map((turn) => `${turn.source}: ${turn.text}`).join('\n');
}

/**
 * `POST /v1/transcribe` answers with SSE: a `meta` event, zero or more
 * `transcript` events, then a final `done` carrying the TranscribeResponse.
 * n8n has no streaming item type, so the node waits for `done` and returns it.
 * Kept pure and exported so it is unit-testable without a live call.
 */
export function parseTranscribeStream(raw: string): IDataObject {
	const blocks = raw.split(/\r?\n\r?\n/);
	const partials: string[] = [];
	let meta: IDataObject | undefined;
	let done: IDataObject | undefined;
	let failure: IDataObject | undefined;

	for (const block of blocks) {
		if (!block.trim()) continue;

		let event = 'message';
		const dataLines: string[] = [];

		for (const line of block.split(/\r?\n/)) {
			if (line.startsWith('event:')) event = line.slice(6).trim();
			else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
		}

		if (dataLines.length === 0) continue;

		let payload: IDataObject;
		try {
			payload = JSON.parse(dataLines.join('\n')) as IDataObject;
		} catch {
			continue;
		}

		if (event === 'done') done = payload;
		else if (event === 'meta') meta = payload;
		else if (event === 'error') failure = payload;
		else if (typeof payload.text === 'string') partials.push(payload.text);
	}

	if (done) return meta ? { ...done, meta } : done;

	// A stream that errors after it started never sends `done`; report what the
	// API said instead of silently returning an empty transcript.
	if (failure) return { text: partials.join(' ').trim(), error: failure, ...(meta ? { meta } : {}) };

	return { text: partials.join(' ').trim(), ...(meta ? { meta } : {}) };
}
