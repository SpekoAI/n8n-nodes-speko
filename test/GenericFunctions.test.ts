import { describe, expect, it } from 'vitest';

import {
	flattenTranscript,
	mimeTypeToExtension,
	parseTranscribeStream,
	toBinaryAudio,
	wrapPcmAsWav,
} from '../nodes/Speko/GenericFunctions';

describe('wrapPcmAsWav', () => {
	// /v1/synthesize answered audio/pcm;rate=24000 on a live prod call, and raw
	// PCM is headerless — it plays nowhere until it is wrapped.
	const pcm = Buffer.alloc(960, 1);

	it('prefixes a 44-byte RIFF/WAVE header without touching the samples', () => {
		const wav = wrapPcmAsWav(pcm, 'audio/pcm;rate=24000');

		expect(wav.length).toBe(pcm.length + 44);
		expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
		expect(wav.subarray(8, 12).toString('latin1')).toBe('WAVE');
		expect(wav.subarray(36, 40).toString('latin1')).toBe('data');
		expect(wav.subarray(44)).toEqual(pcm);
	});

	it('reads the sample rate out of the content-type', () => {
		const wav = wrapPcmAsWav(pcm, 'audio/pcm;rate=16000');

		expect(wav.readUInt32LE(24)).toBe(16000);
		expect(wav.readUInt32LE(28)).toBe(32000); // byte rate = 16000 * 1ch * 2 bytes
		expect(wav.readUInt16LE(22)).toBe(1); // mono
		expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
	});

	it('defaults to 24 kHz when the content-type carries no rate', () => {
		expect(wrapPcmAsWav(pcm, 'audio/pcm').readUInt32LE(24)).toBe(24000);
	});

	it('declares the data chunk size the header promises', () => {
		const wav = wrapPcmAsWav(pcm, 'audio/pcm;rate=24000');

		expect(wav.readUInt32LE(40)).toBe(pcm.length);
		expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
	});
});

describe('toBinaryAudio', () => {
	it('wraps raw PCM and reports it as playable wav', () => {
		const result = toBinaryAudio(Buffer.alloc(100), 'audio/pcm;rate=24000');

		expect(result.mimeType).toBe('audio/wav');
		expect(result.extension).toBe('wav');
		expect(result.buffer.subarray(0, 4).toString('latin1')).toBe('RIFF');
	});

	it('passes a container format through untouched', () => {
		const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
		const result = toBinaryAudio(mp3, 'audio/mpeg');

		expect(result.mimeType).toBe('audio/mpeg');
		expect(result.extension).toBe('mp3');
		expect(result.buffer).toEqual(mp3);
	});
});

describe('mimeTypeToExtension', () => {
	it('maps the formats Speko providers actually return', () => {
		expect(mimeTypeToExtension('audio/mpeg')).toBe('mp3');
		expect(mimeTypeToExtension('audio/wav')).toBe('wav');
		expect(mimeTypeToExtension('audio/ogg')).toBe('ogg');
		expect(mimeTypeToExtension('audio/opus')).toBe('opus');
	});

	it('ignores content-type parameters', () => {
		expect(mimeTypeToExtension('audio/l16;rate=16000')).toBe('pcm');
	});

	it('falls back to mp3 on an unknown type', () => {
		expect(mimeTypeToExtension('application/octet-stream')).toBe('mp3');
	});
});

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
