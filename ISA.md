---
project: n8n-nodes-speko
task: Build the n8n community node package for the Speko agents platform
effort: E3
phase: complete
progress: 49/49
mode: build
started: 2026-08-15
updated: 2026-08-15
---

## Problem

Speko has no presence inside n8n. `SpekoAI/integrations` has carried `n8n verified node · A-led · STAGED`
since 2026-08-08 and nothing was built, because the whole surface was filed behind a single
2–3 month verified-node review clock. That framing is wrong: the community-node path has **no
review gate at all**, and n8n's user base is disproportionately self-hosters — exactly the people
who install unverified packages. Meanwhile `~/code/speko-zapier` already encodes the correct
operation set, error copy, and endpoint map for this exact product surface, and none of it has been
reused. Competitors are already there: Retell AI and ElevenLabs both ship n8n nodes.

## Vision

A clinic operator opens n8n, types "speko", and gets a node that speaks their language: pick an
agent from a dropdown by name, type a phone number, and the call happens. When the call ends, a
Speko Trigger node fires with the transcript attached — no polling, no webhook plumbing, no reading
API docs. The euphoric surprise is that the node ships TTS and STT in the same package, so the same
canvas that places calls can also speak a string and transcribe a file, using one credential.

## Out of Scope

Router (`api.speko.ai`) as a separate credential or a second npm package — the same-slot rule in
`FIT-MATRIX.md` says one Speko listing, agents-led, with TTS/STT riding inside it, and
`api.speko.dev` already exposes `/v1/synthesize` and `/v1/transcribe` so no second host is needed.
Phone-number provisioning, knowledge bases, evals, and agent creation are not in v1 — they are
console workflows, not automation-canvas workflows. Publishing to npm, creating the GitHub repo,
and submitting to the n8n Creator Portal are explicitly out of scope for this build: this session
produces the package, Baymurat fires it.

## Constraints

- Package name MUST be `n8n-nodes-speko` and MUST carry the `n8n-community-node-package` keyword —
  n8n's verification scanner keys on both.
- TypeScript only; node interface, help text, and error copy in English only (verification rule).
- Exactly one third-party service per package; one main node plus one trigger node for the same
  service is the allowed shape.
- From 2026-05-01, verified nodes MUST be published by GitHub Actions with an npm provenance
  statement. Local `npm publish` is rejected. The release workflow ships in this repo.
- Endpoint map, auth header, and user-facing error copy mirror `~/code/speko-zapier` verbatim where
  they overlap — two integrations for one product must not describe it two ways.
- Bearer auth on `Authorization`; keys are `sk_live_…` and are platform keys, never router keys.

## Goal

Produce a compiling, lint-clean `n8n-nodes-speko` package containing a `Speko` action node
(4 resources / 8 operations across Call, Agent, Speech) and a `Speko Trigger` webhook node that
subscribes to workspace webhooks, both backed by one `spekoApi` credential with a live credential
test, plus the provenance-publishing GitHub Actions workflow n8n verification now requires.

## Criteria

- [x] ISC-1: `~/code/n8n-nodes-speko/package.json` exists with `"name": "n8n-nodes-speko"`
- [x] ISC-2: package.json `keywords` contains `n8n-community-node-package`
- [x] ISC-3: package.json has an `n8n` block with `n8nNodesApiVersion: 1`
- [x] ISC-4: package.json `n8n.credentials` lists `dist/credentials/SpekoApi.credentials.js`
- [x] ISC-5: package.json `n8n.nodes` lists both `Speko.node.js` and `SpekoTrigger.node.js`
- [x] ISC-6: package.json declares `n8n-workflow` as a peerDependency
- [x] ISC-7: package.json `license` is `MIT` and a `LICENSE.md` file exists
- [x] ISC-8: `tsconfig.json` exists and emits to `dist/`
- [x] ISC-9: `credentials/SpekoApi.credentials.ts` exports class `SpekoApi implements ICredentialType`
- [x] ISC-10: the credential declares an `apiKey` property with `typeOptions.password: true`
- [x] ISC-11: the credential's `authenticate` block sets `Authorization: Bearer {{$credentials.apiKey}}`
- [x] ISC-12: the credential's `test` hits `https://api.speko.dev/v1/organization`
- [x] ISC-13: `nodes/Speko/Speko.node.ts` exports class `Speko implements INodeType`
- [x] ISC-14: the node declares resources `call`, `agent`, and `speech`
- [x] ISC-15: operation `call:place` POSTs to `/v1/sessions/phone`
- [x] ISC-16: `call:place` sends `variables` only when the user supplied at least one pair
- [x] ISC-17: operation `call:get` GETs `/v1/calls/{id}`
- [x] ISC-18: operation `call:getTranscript` GETs `/v1/sessions/{id}/transcript`
- [x] ISC-19: `call:getTranscript` returns a flattened `text` field joining `source: text` per turn
- [x] ISC-20: operation `call:getRecording` returns n8n binary data, not a JSON blob
- [x] ISC-21: operation `agent:list` GETs `/v1/agents` and returns one item per agent
- [x] ISC-22: a `loadOptions` method populates an Agent dropdown from `/v1/agents`
- [x] ISC-23: operation `speech:synthesize` POSTs `/v1/synthesize` and attaches binary audio output
- [x] ISC-24: `speech:synthesize` sends `intent.language` because the API requires it
- [x] ISC-25: operation `speech:transcribe` POSTs raw audio to `/v1/transcribe`
- [x] ISC-26: `speech:transcribe` sends the `x-speko-intent` header as JSON-encoded routing intent
- [x] ISC-27: `speech:transcribe` parses the SSE stream and returns the final `done` payload
- [x] ISC-28: `nodes/Speko/SpekoTrigger.node.ts` exports class `SpekoTrigger implements INodeType`
- [x] ISC-29: the trigger's `checkExists` / `create` / `delete` hooks call `/v1/webhooks`
- [x] ISC-30: the trigger's event selector offers all five `WorkspaceWebhookEventType` values
- [x] ISC-31: `nodes/Speko/speko.svg` exists and the node `icon` points at it
- [x] ISC-32: a shared `spekoApiRequest` helper centralises base URL, auth, and error mapping
- [x] ISC-33: `.github/workflows/publish.yml` runs `npm publish --provenance` with `id-token: write`
- [x] ISC-34: `README.md` documents every operation and links the API-key page
- [x] ISC-35: `bunx tsc --noEmit` (or the package build) exits 0 with no type errors
- [x] ISC-36: `dist/` contains compiled `.js` for both nodes and the credential after a build
- [x] ISC-37: unit tests for the SSE parser and transcript flattener pass
- [x] ISC-38: Anti: no `sk_live_` key, workspace id, or other secret appears anywhere in the repo
- [x] ISC-39: Anti: nothing in this build publishes to npm, creates a GitHub repo, or submits to n8n
- [x] ISC-40: Anti: no second credential type for the router — one `spekoApi` credential only
- [x] ISC-41: every endpoint the node calls answers 401, not 404, on production
- [x] ISC-42: the recording and synthesize operations stamp mime type from the response header
- [x] ISC-43: the trigger's `delete` hook treats a 404/410 endpoint as successfully deleted
- [x] ISC-44: the credential test returns 200 against a live `sk_live_` key
- [x] ISC-45: synthesized audio written to disk actually decodes and plays
- [x] ISC-46: transcribe returns correct text through the node's own SSE parser
- [x] ISC-47: three create/checkExists/delete webhook cycles leave nothing behind
- [x] ISC-48: `/v1/synthesize` raw PCM is wrapped as WAV so the binary field is playable
- [x] ISC-49: Anti: no probe webhook endpoint survives the verification run

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1..8 | static | manifest fields present | exact match | `Read` / `node -e` on package.json |
| ISC-9..12 | static | credential class shape | symbol present | `Grep` |
| ISC-13..31 | static | node class + operation routing | symbol + URL present | `Grep` |
| ISC-32 | static | helper exported and used | ≥2 call sites | `Grep` |
| ISC-33 | static | provenance flag + permission | both present | `Read` |
| ISC-34 | static | README lists 8 operations | 8 rows | `Grep -c` |
| ISC-35 | build | typecheck | exit 0 | `bunx tsc --noEmit` |
| ISC-36 | build | compiled output | 3 files | `ls dist` |
| ISC-37 | test | unit tests | all pass | `bunx vitest run` |
| ISC-38 | security | secret scan | 0 hits | `rg 'sk_live_[A-Za-z0-9]'` |
| ISC-39 | anti | no publish/repo side effects | 0 | `npm view` 404 + `gh repo view` fails |
| ISC-40 | anti | credential count | exactly 1 | `ls credentials` |

## Features

| name | description | satisfies | depends_on | parallelizable |
|------|-------------|-----------|------------|----------------|
| scaffold | package.json, tsconfig, gulpfile, license, gitignore, icon | ISC-1..8, ISC-31 | — | no |
| credential | `spekoApi` credential with bearer auth + live test | ISC-9..12 | scaffold | yes |
| transport | `spekoApiRequest` helper: base URL, auth, error mapping | ISC-32 | scaffold | yes |
| node-call | Call resource: place, get, getTranscript, getRecording | ISC-15..20 | transport | yes |
| node-agent | Agent resource: list + loadOptions dropdown | ISC-21, ISC-22 | transport | yes |
| node-speech | Speech resource: synthesize (binary out), transcribe (SSE in) | ISC-23..27 | transport | yes |
| trigger | Speko Trigger webhook node with subscribe/unsubscribe hooks | ISC-28..30 | transport | yes |
| release | GitHub Actions provenance publish workflow | ISC-33 | scaffold | yes |
| docs | README with operation table and setup steps | ISC-34 | all nodes | no |
| verify | typecheck, build, unit tests, secret scan | ISC-35..40 | all | no |

## Decisions

- **2026-08-15** — Programmatic node (`execute()`), not declarative routing. Two operations move
  binary audio and one flattens a transcript; declarative `routing` cannot express either without a
  post-receive hack. Declarative is n8n's default recommendation, so this is a deliberate departure.
- **2026-08-15** — One credential, not two. `/v1/synthesize` and `/v1/transcribe` are served by
  `api.speko.dev` on the same platform key, so the same-slot rule costs nothing here. A router
  credential would have forced users to understand that router keys and platform keys are separate
  control planes that share the `sk_live_` prefix.
- **2026-08-15** — Endpoint map, error copy, and field help text lifted from `~/code/speko-zapier`
  rather than re-derived from the OpenAPI spec, so the two automation listings describe one product
  identically. Shapes cross-checked against `apps/docs/content/openapi.json` (46 paths).
- **2026-08-15** — `refined:` scope trimmed to package-only. Publishing, repo creation, and Creator
  Portal submission are Baymurat's to fire; ISC-39 makes that an anti-criterion rather than a note.
- **2026-08-15** — Delegation floor (E3 soft ≥2) relaxed to 0. Show-your-math: Forge/Anvil would
  have written the same node from the same blueprint, and the session directive forbids spawning
  agents. The blueprint (`speko-zapier`) plus the OpenAPI spec removes the ambiguity delegation
  would have resolved.
- **2026-08-15** — `bun install` / `bunx` used locally; npm appears only inside the release workflow,
  where npm provenance is the required publish path. Earlier draft of this entry had it backwards.
- **2026-08-15** — `inputs: ['main']` as string literals rather than `NodeConnectionTypes.Main`.
  n8n renamed the runtime const (`NodeConnectionType` is type-only in 1.120), and the literal
  typechecks across every version, so the node does not pin itself to one n8n minor.
- **2026-08-15** — `cred-class-field-documentation-url-miscased` disabled. It is documented as
  main-repo-only but still fires on community credentials, where the sibling rule
  `documentation-url-not-http-url` demands the opposite. Both cannot be satisfied.
- **2026-08-15** — SSE transcribe is buffered, not streamed. n8n has no streaming item type, so the
  node waits for `done` and returns one item. Trade-off accepted: no cross-chunk framing bug is
  possible, but a very long clip is held in memory.
- **2026-08-15** — `refined:` after the advisor pass, three defects were fixed rather than noted:
  the trigger's `delete` hook returned `false` on a 404 (which would trap a user in a workflow they
  could not deactivate), and both binary operations hardcoded `audio/mpeg` regardless of what the
  provider returned. Mime type is now read from the response header.

## Changelog

- **2026-08-15**
  - conjectured: the n8n surface is gated behind a 2–3 month verified-node review, so nothing can
    ship before Demo Day.
  - refuted by: n8n's own docs — the community-node path has no review gate at all; verification
    only adds n8n Cloud installability and in-app discovery on top of a package self-hosters can
    already install from npm the day it is published.
  - learned: "n8n" is three separate surfaces with three separate clocks (zero-build HTTP/MCP
    recipe, ungated community node, gated verified node), and the tracker was pricing all three at
    the slowest one.
  - criterion now: ISC-33 requires the provenance workflow so the slow path can start early, but no
    ISC blocks on verification — the package is done when it installs from npm.

- **2026-08-15**
  - conjectured: `/v1/synthesize` returns a container audio format, so stamping the binary field
    from the response `content-type` is enough to make it usable.
  - refuted by: a live prod call returned `audio/pcm;rate=24000` — 303,360 bytes of headerless raw
    PCM. It is real audio of a plausible length that no player and no downstream n8n node can open,
    and there is no output-format request parameter to ask for something else; the format follows
    whichever provider the router picked, so the same workflow can get mp3 one run and PCM the next.
  - learned: for a routed multi-provider audio API, the response format is a routing outcome, not a
    contract. Any client has to normalise, not just label.
  - criterion now: ISC-48 — raw PCM is wrapped in a 44-byte RIFF header before it reaches the binary
    field, verified by `afinfo` decoding the result as `1 ch, 24000 Hz, Int16, 6.32 sec`.

## Verification

- ISC-1..7: `node -e` on package.json — `name=n8n-nodes-speko`, `kw n8n-community-node-package=true`,
  `apiVersion=1`, credentials/nodes paths point at `dist/`, `peer={"n8n-workflow":"*"}`, `license=MIT`
- ISC-8, ISC-36: `bun run build` exit 0 → `dist/` holds `SpekoApi.credentials.js`,
  `GenericFunctions.js`, `Speko.node.js`, `SpekoTrigger.node.js`, `speko.svg`
- ISC-9..12: `grep` — `class SpekoApi implements ICredentialType`, `typeOptions: { password: true }`,
  `Authorization: '=Bearer {{$credentials.apiKey}}'`, `url: '/v1/organization'`
- ISC-13..27: `grep` — node class present; resources `agent`/`call`/`speech`; `/v1/sessions/phone`,
  `/v1/calls/${…}`, `/v1/sessions/${…}/transcript`, `/v1/calls/${…}/recording`, `/v1/agents`,
  `/v1/synthesize`, `/v1/transcribe`; `pairs.length > 0` gates `variables`; `x-speko-intent` header
  set; `parseTranscribeStream` and `flattenTranscript` wired; `prepareBinaryData` on both audio paths
- ISC-22: `loadOptionsMethod: 'getAgents'` at two call sites (Place Call, Get Agent)
- ISC-28..30: `grep` — `class SpekoTrigger implements INodeType`; `checkExists`/`create`/`delete`
  all hitting `/v1/webhooks`; all five `WorkspaceWebhookEventType` values in the selector
- ISC-31: `icon: 'file:speko.svg'` in both nodes; `nodes/Speko/speko.svg` is 418 bytes
- ISC-32: `spekoApiRequest.call` at 13 sites across the two node files
- ISC-33: `.github/workflows/publish.yml` lines 13 and 34 — `id-token: write`, `npm publish --provenance`
- ISC-34: `grep -c` on README operation rows = 8
- ISC-35: `bunx tsc --noEmit` exit 0
- ISC-37: `bunx vitest run` — 10 tests passed, 1 file
- ISC-38: `rg 'sk_live_[A-Za-z0-9]'` exit 1 (no matches outside node_modules)
- ISC-39: `npm view n8n-nodes-speko` → 404; `gh repo view SpekoAI/n8n-nodes-speko` → does not resolve
- ISC-40: `ls credentials/ | wc -l` = 1
- ISC-41: unauthenticated `fetch` against all nine routes on `api.speko.dev` → 401 on every one,
  so no route in this node is a documentation guess
- ISC-42: `mimeTypeToExtension` unit-tested across mpeg/wav/ogg/opus/l16 plus fallback; both audio
  operations read `content-type` from `returnFullResponse`
- ISC-43: `grep` — `if (status !== 404 && status !== 410) return false` in the delete hook
- ISC-44..49: live round-trip against **production** `api.speko.dev`, 11/11 checks passed
  (harness: `scratchpad/n8n-live-verify.mjs`, run 2026-08-15):
  - ISC-44: `GET /v1/organization` → 200, body carries `id,name,slug,logo,createdAt,…`
  - agent paths: `GET /v1/agents` → 200, 1 agent, keys `id,organizationId,name,voice,…`;
    `GET /v1/agents/{id}` → 200
  - ISC-45: `POST /v1/synthesize` → 200 `audio/pcm;rate=24000`, normalised to `audio/wav`;
    `afinfo speech.wav` → `WAVE, 1 ch, 24000 Hz, Int16, estimated duration 6.32 sec`
  - ISC-46: `POST /v1/transcribe` on that audio → 200, parsed by the node's own
    `parseTranscribeStream` → `"Hi, this is Ava calling from Northside Clinic. Is now a good time to
    confirm your appointm…"`, keys `text,provider,model,providerPath,confidence,failoverCount`
  - call:place body contract: `POST /v1/sessions/phone` with a bogus agent → `404
    {"error":"Agent not found","code":"AGENT_NOT_FOUND"}`, so the field names parse and no call was
    placed to verify it
  - ISC-47: three cycles of create `201` → checkExists `200` → delete `204` → afterDelete `404`
  - ISC-43: a second delete on an already-gone endpoint returns `404`, which the node treats as success
  - ISC-49: workspace webhook list after the run → 0 endpoints, 0 probe leftovers
