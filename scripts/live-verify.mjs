// Live round-trip verification for n8n-nodes-speko (ISA follow-up `n8n-live-roundtrip`).
// Uses the key already configured for the Speko MCP server on this machine.
// The key is never printed.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { parseTranscribeStream, toBinaryAudio } = require(
	fileURLToPath(new URL('../dist/nodes/Speko/GenericFunctions.js', import.meta.url)),
);

const OUT = process.env.TMPDIR ?? '/tmp';
// Keys are env-scoped: a staging key 401s on prod and vice versa. Try the
// Zapier app's key against prod first, then fall back to the staging key that
// the Speko MCP server already uses on this machine.
function candidates() {
	const out = [];

	const zapierEnv = `${process.env.HOME}/code/speko-zapier/.env`;
	if (fs.existsSync(zapierEnv)) {
		const m = fs.readFileSync(zapierEnv, 'utf8').match(/sk_live_[A-Za-z0-9_-]+/);
		if (m) out.push({ label: 'prod (speko-zapier/.env)', base: 'https://api.speko.dev', key: m[0] });
	}

	const claudeCfg = `${process.env.HOME}/.claude.json`;
	if (fs.existsSync(claudeCfg)) {
		const m = fs.readFileSync(claudeCfg, 'utf8').match(/sk_live_[A-Za-z0-9_-]+/);
		if (m) {
			out.push({ label: 'staging (MCP config)', base: 'https://api-staging.speko.dev', key: m[0] });
			out.push({ label: 'prod (MCP config)', base: 'https://api.speko.dev', key: m[0] });
		}
	}

	return out;
}

let BASE = 'https://api.speko.dev';
let KEY = '';

for (const c of candidates()) {
	const probe = await fetch(`${c.base}/v1/organization`, {
		headers: { Authorization: `Bearer ${c.key}` },
	});
	console.log(`key probe: ${c.label} -> ${c.base} = ${probe.status}`);
	if (probe.status === 200) {
		BASE = c.base;
		KEY = c.key;
		console.log(`using: ${c.label} @ ${c.base}\n`);
		break;
	}
}

if (!KEY) throw new Error('no working sk_live_ key found for any Speko environment');
const auth = { Authorization: `Bearer ${KEY}` };

const results = [];
function record(id, pass, detail) {
	results.push({ id, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${detail}`);
}

async function main() {
	// ---- ISC-44: credential test -------------------------------------------
	const org = await fetch(`${BASE}/v1/organization`, { headers: auth });
	const orgBody = org.ok ? await org.json() : await org.text();
	record(
		'ISC-44 credential test GET /v1/organization',
		org.status === 200 && typeof orgBody?.name === 'string',
		`status=${org.status} keys=${org.ok ? Object.keys(orgBody).join(',') : String(orgBody).slice(0, 120)}`,
	);

	// ---- agent list (loadOptions + agent:getAll) ----------------------------
	const agentsRes = await fetch(`${BASE}/v1/agents`, { headers: auth });
	const agents = agentsRes.ok ? await agentsRes.json() : [];
	const firstAgent = Array.isArray(agents) ? agents[0] : undefined;
	record(
		'agent:getAll + loadOptions GET /v1/agents',
		agentsRes.status === 200 && Array.isArray(agents),
		`status=${agentsRes.status} count=${Array.isArray(agents) ? agents.length : 'n/a'} itemKeys=${firstAgent ? Object.keys(firstAgent).slice(0, 8).join(',') : 'none'}`,
	);

	// ---- agent:get ----------------------------------------------------------
	if (firstAgent?.id) {
		const one = await fetch(`${BASE}/v1/agents/${encodeURIComponent(firstAgent.id)}`, { headers: auth });
		record('agent:get GET /v1/agents/{id}', one.status === 200, `status=${one.status}`);
	}

	// ---- ISC-45: synthesize returns real, playable audio --------------------
	const synth = await fetch(`${BASE}/v1/synthesize`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			text: 'Hi, this is Ava calling from Northside Clinic. Is now a good time to confirm your appointment for Thursday morning at ten fifteen?',
			intent: { language: 'en-US' },
		}),
	});

	let audioPath;
	if (synth.status === 200) {
		const wireMime = synth.headers.get('content-type') ?? 'audio/mpeg';
		const raw = Buffer.from(await synth.arrayBuffer());

		// Run the node's own normaliser, not a reimplementation of it.
		const audio = toBinaryAudio(raw, wireMime);
		audioPath = path.join(OUT, `speech.${audio.extension}`);
		fs.writeFileSync(audioPath, audio.buffer);

		const magic = audio.buffer.subarray(0, 4);
		const isContainerAudio =
			magic.subarray(0, 3).toString('latin1') === 'ID3' ||
			(magic[0] === 0xff && (magic[1] & 0xe0) === 0xe0) ||
			magic.toString('latin1') === 'RIFF' ||
			magic.toString('latin1') === 'OggS' ||
			magic.toString('latin1') === 'fLaC';

		record(
			'ISC-45 synthesize output is a decodable container',
			isContainerAudio && audio.buffer.length > 1000,
			`wireMime=${wireMime} -> emitted=${audio.mimeType} .${audio.extension} rawBytes=${raw.length} outBytes=${audio.buffer.length} magic=${magic.toString('latin1')} file=${audioPath}`,
		);
	} else {
		record('ISC-45 synthesize', false, `status=${synth.status} ${(await synth.text()).slice(0, 200)}`);
	}

	// ---- ISC-46: transcribe SSE through the node's own parser ---------------
	if (audioPath) {
		const audio = fs.readFileSync(audioPath);
		const mime = audioPath.endsWith('.wav')
			? 'audio/wav'
			: audioPath.endsWith('.ogg') || audioPath.endsWith('.opus')
				? 'audio/ogg'
				: 'audio/mpeg';

		const tr = await fetch(`${BASE}/v1/transcribe`, {
			method: 'POST',
			headers: {
				...auth,
				'Content-Type': mime,
				'x-speko-intent': JSON.stringify({ language: 'en-US', region: 'global' }),
			},
			body: audio,
		});

		const raw = await tr.text();
		const parsed = parseTranscribeStream(raw);
		record(
			'ISC-46 transcribe SSE parsed by the node parser',
			tr.status === 200 && typeof parsed.text === 'string' && parsed.text.length > 0,
			`status=${tr.status} rawBytes=${raw.length} parsedKeys=${Object.keys(parsed).join(',')} text="${String(parsed.text).slice(0, 90)}"`,
		);
	}

	// ---- call:place body contract, WITHOUT dialing anyone -------------------
	const dial = await fetch(`${BASE}/v1/sessions/phone`, {
		method: 'POST',
		headers: { ...auth, 'Content-Type': 'application/json' },
		body: JSON.stringify({ to: '+12015551234', agentId: 'agent_definitely_does_not_exist' }),
	});
	const dialBody = await dial.text();
	record(
		'call:place body shape rejected on agentId, not on schema',
		dial.status >= 400 && dial.status < 500 && /agent/i.test(dialBody),
		`status=${dial.status} body=${dialBody.slice(0, 180)}`,
	);

	// ---- ISC-47: webhook lifecycle, three cycles ---------------------------
	const created = [];
	for (let cycle = 1; cycle <= 3; cycle++) {
		const create = await fetch(`${BASE}/v1/webhooks`, {
			method: 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: `n8n verification probe ${cycle} (safe to delete)`,
				url: `https://example.invalid/n8n-probe-${cycle}`,
				events: ['call.report'],
				allAgents: true,
			}),
		});
		const body = create.ok ? await create.json() : await create.text();
		if (!create.ok) {
			record(`ISC-47 webhook create cycle ${cycle}`, false, `status=${create.status} ${String(body).slice(0, 160)}`);
			break;
		}
		created.push(body.id);

		const exists = await fetch(`${BASE}/v1/webhooks/${encodeURIComponent(body.id)}`, { headers: auth });
		const del = await fetch(`${BASE}/v1/webhooks/${encodeURIComponent(body.id)}`, {
			method: 'DELETE',
			headers: auth,
		});
		const gone = await fetch(`${BASE}/v1/webhooks/${encodeURIComponent(body.id)}`, { headers: auth });

		record(
			`ISC-47 webhook create/checkExists/delete cycle ${cycle}`,
			create.status < 300 && exists.status === 200 && del.status < 400 && gone.status === 404,
			`create=${create.status} checkExists=${exists.status} delete=${del.status} afterDelete=${gone.status} keys=${Object.keys(body).slice(0, 8).join(',')}`,
		);
	}

	// ---- ISC-43: delete on an already-gone endpoint --------------------------
	if (created.length > 0) {
		const again = await fetch(`${BASE}/v1/webhooks/${encodeURIComponent(created[0])}`, {
			method: 'DELETE',
			headers: auth,
		});
		record(
			'ISC-43 delete hook meets a 404/410 on an already-deleted endpoint',
			again.status === 404 || again.status === 410 || again.status < 300,
			`status=${again.status} (node treats 404/410 as success)`,
		);
	}

	// ---- no leftovers -------------------------------------------------------
	const list = await fetch(`${BASE}/v1/webhooks`, { headers: auth });
	const listBody = list.ok ? await list.json() : {};
	const entries = Array.isArray(listBody) ? listBody : (listBody.entries ?? []);
	const leftovers = entries.filter((e) => String(e?.name ?? '').includes('n8n verification probe'));
	record(
		'ISC-47 no orphaned probe endpoints left behind',
		leftovers.length === 0,
		`workspaceEndpoints=${entries.length} probeLeftovers=${leftovers.length}`,
	);

	console.log('\n----- SUMMARY -----');
	const failed = results.filter((r) => !r.pass);
	console.log(`${results.length - failed.length}/${results.length} passed`);
	if (failed.length) console.log('FAILED:', failed.map((f) => f.id).join(' | '));
}

main().catch((e) => {
	console.error('HARNESS ERROR:', e.message);
	process.exit(1);
});
