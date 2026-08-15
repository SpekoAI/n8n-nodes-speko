# n8n-nodes-speko

Give your n8n workflows a phone. This community node lets [Speko](https://speko.dev) place
outbound voice-agent calls, read back transcripts and recordings, and convert speech in either
direction — all from one credential.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow
automation platform.

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/),
then enter `n8n-nodes-speko` as the npm package name.

Self-hosted, from the command line:

```bash
npm install n8n-nodes-speko
```

## Credentials

Create an API key at [platform.speko.dev/api-keys](https://platform.speko.dev/api-keys) and paste
it into a **Speko API** credential. Keys start with `sk_live_`. The credential test calls
`GET /v1/organization`, so a green check means the key can actually reach your workspace.

## Operations

### Speko

| Resource | Operation | What it does |
| --- | --- | --- |
| Call | Place | Calls a phone number and runs one of your voice agents on the line |
| Call | Get | Looks up a call — status, duration, and outcome |
| Call | Get Transcript | Returns the turns plus a flattened `text` field of the whole conversation |
| Call | Get Recording | Downloads the call audio into a binary field |
| Agent | Get Many | Lists the voice agents in your workspace |
| Agent | Get | Fetches one agent by ID |
| Speech | Synthesize | Turns text into speech audio in any supported language |
| Speech | Transcribe | Turns an audio file into text |

The Agent field is a dropdown loaded live from your workspace, so you pick a name instead of
pasting an `agent_…` ID.

**Prompt variables.** If your agent prompt contains `{{placeholders}}`, fill them per call under
*Additional Fields → Prompt Variables*. Leave it empty and the prompt is sent as written.

**AI Agent tool.** The Speko node is marked `usableAsTool`, so an n8n AI Agent can call it directly
— that is the "give your AI agent a phone" path with no extra wiring.

### Speko Trigger

Starts a workflow when a Speko call event arrives. This is a real subscription, not a poll: the
node registers a workspace webhook when the workflow activates and deletes it when the workflow is
deactivated.

Events: `call.pre_call`, `call.status`, `call.report`, `call.analysis`, `call.recording`.

`call.report` is the one to reach for by default — it is durable, so a failed delivery is retried
on a backoff rather than dropped.

Leave **Agent Names or IDs** empty to fire for every agent, or select specific agents to narrow it.

## Compatibility

Requires n8n `1.82` or later and Node.js `20.15` or later.

## Example: after-hours callback

1. **Webhook** — a form on your site posts a lead.
2. **Speko → Call → Place** — call the lead with your Front Desk agent, passing `{{name}}` as a
   prompt variable.
3. **Speko Trigger → Call Report** — in a second workflow, catch the finished call.
4. **Speko → Call → Get Transcript** — pull the conversation.
5. Write the outcome into your CRM.

## Verifying against a live workspace

`npm run build && node scripts/live-verify.mjs` exercises every path the node uses against a real
Speko workspace: credential test, agent list and lookup, a synthesize → transcribe round trip
through the node's own SSE parser, the outbound-call body contract (without dialing anyone), and
three webhook create/check/delete cycles that must leave nothing behind.

It reads an `sk_live_` key from files already on the machine and never prints it. Keys are
environment-scoped — a staging key returns 401 against `api.speko.dev` — so the script probes each
candidate and reports which environment it landed in.

**Note on audio format:** `/v1/synthesize` has no output-format parameter. The format follows
whichever provider the router picked, so the same workflow can receive `audio/mpeg` on one run and
`audio/pcm;rate=24000` on the next. Raw PCM is headerless and plays nowhere, so the node wraps it in
a RIFF header before it reaches the binary field. The audio in your workflow is always openable.

## Resources

- [Speko documentation](https://docs.speko.dev)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
