---
project: n8n-nodes-speko
task: Build the n8n community node package for the Speko agents platform
effort: E3
phase: observe
progress: 0/36
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

- [ ] ISC-1: `~/code/n8n-nodes-speko/package.json` exists with `"name": "n8n-nodes-speko"`
- [ ] ISC-2: package.json `keywords` contains `n8n-community-node-package`
- [ ] ISC-3: package.json has an `n8n` block with `n8nNodesApiVersion: 1`
- [ ] ISC-4: package.json `n8n.credentials` lists `dist/credentials/SpekoApi.credentials.js`
- [ ] ISC-5: package.json `n8n.nodes` lists both `Speko.node.js` and `SpekoTrigger.node.js`
- [ ] ISC-6: package.json declares `n8n-workflow` as a peerDependency
- [ ] ISC-7: package.json `license` is `MIT` and a `LICENSE.md` file exists
- [ ] ISC-8: `tsconfig.json` exists and emits to `dist/`
- [ ] ISC-9: `credentials/SpekoApi.credentials.ts` exports class `SpekoApi implements ICredentialType`
- [ ] ISC-10: the credential declares an `apiKey` property with `typeOptions.password: true`
- [ ] ISC-11: the credential's `authenticate` block sets `Authorization: Bearer {{$credentials.apiKey}}`
- [ ] ISC-12: the credential's `test` hits `https://api.speko.dev/v1/organization`
- [ ] ISC-13: `nodes/Speko/Speko.node.ts` exports class `Speko implements INodeType`
- [ ] ISC-14: the node declares resources `call`, `agent`, and `speech`
- [ ] ISC-15: operation `call:place` POSTs to `/v1/sessions/phone`
- [ ] ISC-16: `call:place` sends `variables` only when the user supplied at least one pair
- [ ] ISC-17: operation `call:get` GETs `/v1/calls/{id}`
- [ ] ISC-18: operation `call:getTranscript` GETs `/v1/sessions/{id}/transcript`
- [ ] ISC-19: `call:getTranscript` returns a flattened `text` field joining `source: text` per turn
- [ ] ISC-20: operation `call:getRecording` returns n8n binary data, not a JSON blob
- [ ] ISC-21: operation `agent:list` GETs `/v1/agents` and returns one item per agent
- [ ] ISC-22: a `loadOptions` method populates an Agent dropdown from `/v1/agents`
- [ ] ISC-23: operation `speech:synthesize` POSTs `/v1/synthesize` and attaches binary audio output
- [ ] ISC-24: `speech:synthesize` sends `intent.language` because the API requires it
- [ ] ISC-25: operation `speech:transcribe` POSTs raw audio to `/v1/transcribe`
- [ ] ISC-26: `speech:transcribe` sends the `x-speko-intent` header as JSON-encoded routing intent
- [ ] ISC-27: `speech:transcribe` parses the SSE stream and returns the final `done` payload
- [ ] ISC-28: `nodes/Speko/SpekoTrigger.node.ts` exports class `SpekoTrigger implements INodeType`
- [ ] ISC-29: the trigger's `checkExists` / `create` / `delete` hooks call `/v1/webhooks`
- [ ] ISC-30: the trigger's event selector offers all five `WorkspaceWebhookEventType` values
- [ ] ISC-31: `nodes/Speko/speko.svg` exists and the node `icon` points at it
- [ ] ISC-32: a shared `spekoApiRequest` helper centralises base URL, auth, and error mapping
- [ ] ISC-33: `.github/workflows/publish.yml` runs `npm publish --provenance` with `id-token: write`
- [ ] ISC-34: `README.md` documents every operation and links the API-key page
- [ ] ISC-35: `bunx tsc --noEmit` (or the package build) exits 0 with no type errors
- [ ] ISC-36: `dist/` contains compiled `.js` for both nodes and the credential after a build
- [ ] ISC-37: unit tests for the SSE parser and transcript flattener pass
- [ ] ISC-38: Anti: no `sk_live_` key, workspace id, or other secret appears anywhere in the repo
- [ ] ISC-39: Anti: nothing in this build publishes to npm, creates a GitHub repo, or submits to n8n
- [ ] ISC-40: Anti: no second credential type for the router — one `spekoApi` credential only

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
- **2026-08-15** — npm used for install/build instead of bun. n8n's toolchain, the verification
  scanner, and the provenance publish path are all npm-native; `bun` is used where it is a drop-in.
