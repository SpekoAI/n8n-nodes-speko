import { describe, expect, it } from 'vitest';

import { flattenTranscript, parseTranscribeStream } from '../nodes/Speko/GenericFunctions';

describe('flattenTranscript', () => {
	it('joins each turn as "source: text" on its own line', () => {
		const text = flattenTranscript([
			{ index: 0, source: 'agent', text: 'Hi, this is Ava calling from Northside Clinic.' },
			{ index: 1, source: 'user', text: 'Oh, hello.' },
		]);

		expect(text).toBe(
			'agent: Hi, this is Ava calling from Northside Clinic.\nuser: Oh, hello.',
		);
	});

	it('returns an empty string when a call has no turns', () => {
		expect(flattenTranscript([])).toBe('');
		expect(flattenTranscript(undefined)).toBe('');
	});
});

describe('parseTranscribeStream', () => {
	it('returns the done payload and folds meta into it', () => {
		const stream = [
			'event: meta\ndata: {"provider":"deepgram","model":"nova-3"}',
			'event: transcript\ndata: {"text":"book me"}',
			'event: done\ndata: {"text":"book me an appointment","durationSeconds":2.1}',
			'',
		].join('\n\n');

		expect(parseTranscribeStream(stream)).toEqual({
			text: 'book me an appointment',
			durationSeconds: 2.1,
			meta: { provider: 'deepgram', model: 'nova-3' },
		});
	});

	it('falls back to joined partials when the stream never completes', () => {
		const stream = [
			'event: transcript\ndata: {"text":"book me"}',
			'event: transcript\ndata: {"text":"an appointment"}',
			'',
		].join('\n\n');

		expect(parseTranscribeStream(stream)).toEqual({ text: 'book me an appointment' });
	});

	it('surfaces an error event instead of returning a silently empty transcript', () => {
		const stream = [
			'event: transcript\ndata: {"text":"book"}',
			'event: error\ndata: {"error":"upstream provider closed the stream"}',
			'',
		].join('\n\n');

		expect(parseTranscribeStream(stream)).toEqual({
			text: 'book',
			error: { error: 'upstream provider closed the stream' },
		});
	});

	it('tolerates CRLF line endings and blank keep-alive blocks', () => {
		const stream = 'event: done\r\ndata: {"text":"ok"}\r\n\r\n\r\n';
		expect(parseTranscribeStream(stream)).toEqual({ text: 'ok' });
	});

	it('ignores non-JSON data lines rather than throwing', () => {
		const stream = 'event: transcript\ndata: not-json\n\nevent: done\ndata: {"text":"ok"}\n\n';
		expect(parseTranscribeStream(stream)).toEqual({ text: 'ok' });
	});
});
