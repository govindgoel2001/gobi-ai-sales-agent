# gobi-ai-sales-agent design

Date: 2026-09-17
Repo: github.com/govindgoel2001/gobi-ai-sales-agent
Status: approved, ready for an implementation plan

## What this is

A WhatsApp sales agent that a non-developer can clone, configure by talking to Claude
Code, and run on a small VPS. It is published to the AI Horizon Skool community as a free
build, and it doubles as the thing a company brain deploys when someone asks it for a
sales agent.

The public promise is the Instagram post from 2026-09-17:

> I built a 24/7 AI sales agent that chats on WhatsApp, remembers every lead, qualifies
> prospects, answers questions and can even take voice calls while I sleep.
> WhatsApp + AI + Supabase + VPS.
> Comment "AGENT" and I'll send you the full free guide + GitHub build.

Every claim in that paragraph has to be true of the repo, and the two things the post does
not say have to be stated plainly in the docs rather than discovered later by someone who
already told their customers the bot works.

## Constraints that come from Meta, not from us

A free-form text message can only be sent inside 24 hours of that person's last inbound
message. Outside the window, Meta rejects the send, and the only way through is an
approved message template. So the agent is 24/7 for anyone who writes to it, and is not
free to re-open a conversation that went cold. The README says this above the fold.

Production access to the WhatsApp Cloud API requires Meta business verification. Until
that clears, a number can only talk to a short list of test recipients. This is the step
where most people in the community will stall, so it gets its own section with the
sequencing made explicit.

## Starting point

A zip produced by ChatGPT, 29 files, 456 lines of TypeScript under `src/`. It is a real
skeleton, not filler, and its architecture is kept: Express with raw-body capture,
Supabase for contacts and messages, Meta Cloud API v23.0 for chat, Twilio Media Streams
bridged into OpenAI Realtime for voice, Docker and pm2 for deploy, a CI job that
typechecks.

What it already gets right: HMAC verification with `timingSafeEqual`, acknowledging the
webhook with 200 before doing any AI work so Meta does not retry, support for both the
Responses and Chat Completions API shapes, zod validation of env so the process fails at
boot rather than at the first customer message, and row level security enabled on both
tables.

## Defects being fixed

### The webhook is open

`WHATSAPP_APP_SECRET` is optional in the zod schema and `verifyMetaSignature` returns
`true` when it is unset. Anyone who finds the URL can drive the agent, spend the owner's
model credits, and write rows. The secret becomes required, and verification fails closed.

### Retries are not deduplicated

Meta re-delivers on any hiccup, producing a second AI reply and a second stored message. A
`processed_messages` table keyed on Meta's message id, written insert-on-conflict-do-nothing
before any model call, makes a retry a no-op.

### The 24 hour window is swallowed

Outside the window the send fails and the error goes into `console.error`, so the owner
sees silence and concludes the agent is broken. Contacts gain `last_inbound_at`, outbound
messages record a status, and Meta's out-of-window error code is matched by name and
surfaced as what it is.

### Nothing caps spend

A per-contact token bucket plus a global daily ceiling, `DAILY_MESSAGE_CAP`, defaulting to
500 replies in a rolling 24 hours. A spammer or a reply loop cannot produce an unbounded
bill. Hitting the ceiling logs loudly and stops replying rather than degrading quietly.

### Voice does not persist

Calls resolve a contact by caller number and write turns with `channel='voice'`, so
"remembers every lead" is true for calls and not only for chat.

### Two unguarded parses

`JSON.parse` on both WebSocket message handlers in `src/voice/twilio-realtime.ts` will
throw on a malformed frame and take the process down. Both get guarded.

### No tests

CI runs `tsc --noEmit` and nothing else. Vitest is added with real coverage of signature
verification, lead scoring, handoff detection, the knowledge budget, and dedup, plus one
test that posts a correctly signed synthetic Meta payload at the app and asserts the reply
path runs. No network in tests. CI runs them beside the typecheck.

## The knowledge layer

`BUSINESS_CONTEXT`, a single env string pasted into every request, is removed. It is both
a per-message token cost and a hard ceiling on what the agent can ever know.

In its place, a `knowledge/` folder of markdown. Someone writes products, prices, FAQs,
policies and booking rules as plain files. They load at boot against a token budget,
`KNOWLEDGE_MAX_TOKENS`, defaulting to 6000. If the budget is exceeded the app names the
offending file and the overage instead of silently truncating. Example files ship in the
repo so nobody faces an empty folder.

No embeddings, no vector store, no ingestion step, nothing extra to install, and a
non-technical person can edit it in Notepad. The practical ceiling is a few thousand words
of business knowledge, which covers the businesses this audience runs.

The loader sits behind a small provider interface so a retrieval-backed provider can be
added later without touching the agent, but only the file provider is built now.

## Company brain integration

The brain exports. It does not serve.

The brain indexes with Ollama and mxbai-embed-large at 1024 dimensions, with
`EMBEDDING_PROVIDER=local` as its documented default. Vectors only compare against vectors
from the same model, so any live query against `search_chunks` has to be embedded by that
same local model. Requiring a beginner to install Ollama on a small VPS and hold an
embedding model in RAM to answer one short question per message is the wrong trade.

So the brain's sales department does the retrieval where Ollama already runs, assembles
what a customer is allowed to know, and writes it as markdown into the agent's
`knowledge/` folder. The agent keeps zero runtime dependencies, does not care whether the
brain machine is awake, and deploys on the smallest VPS available.

This also turns a prompt rule into a review step. A company brain holds internal notes and
a sales agent talks to strangers, so the safest boundary is a human reading generated
files before they ship, with a diff to read when knowledge is regenerated.

Live retrieval stays documented as an advanced path for anyone already running Ollama
beside the agent. It is not the default and it is not built first.

On the brain side this is a new `sales` department plus a skill that clones this repo and
runs its setup, so opening a company brain and asking for a sales agent does something
real. That change lands in the company-brain repo, separate from the template branch that
has not been pushed.

## The Claude Code layer

This is what makes "just text Claude Code" true, and it is the difference between the
owner answering forty DMs and answering four.

Repo root gets a `CLAUDE.md` describing the project and the order operations happen in.
`.claude/skills/` gets four:

`setup` walks through the Meta app, the env file, the Supabase schema, the tunnel, webhook
verification, and a first real message, verifying each step before moving to the next.

`knowledge` interviews the owner about their business and writes the markdown files, so
the folder is never empty.

`deploy` handles the VPS: Docker, Caddy for TLS, systemd, a health check, and repointing
Meta at the production URL.

`doctor` diagnoses a dead agent. Checks env, hits `/health`, verifies the Meta webhook
subscription, tails logs, and names the actual fault.

## Deploy path

A tunnel first, because Meta will not verify a webhook on localhost and nobody should have
to buy a server before seeing the thing work. Then a VPS section with Docker, Caddy and
systemd for anything that stays up.

## The status page

`web/index.html` is kept and moved. It currently deploys to Vercel and reads the worker URL
from a query string, which means its status indicator never works in practice, and it adds
a third deploy target to a guide that already asks for a tunnel and a VPS.

Instead the Express app serves it at `/`, replacing the JSON blob nobody reads, checking
its own origin's `/health` with no query string. Opening the tunnel URL in a browser after
setup gives a live page with a green dot, which is the first-success moment the guide is
built around. It also renders the counts already sitting in Supabase, contacts and
messages and how many are hot, so it is worth opening twice. `web/vercel.json` and the
Vercel path are dropped.

## Docs

`README.md` covers what it is, what it costs, the 24 hour window, and a ten minute
quickstart. Separate pages handle Meta setup, VPS deploy, voice, the company brain
integration, and troubleshooting. A Skool-shaped guide document ships alongside, because
the Instagram caption promised a guide and not only a repo.

Costs are listed as real line items for Meta, Supabase, the model, Twilio and the VPS,
sourced from the current pricing pages and linked. No figures written from memory.

## Out of scope

No pgvector and no embeddings in the agent. No web dashboard beyond the status page. No
channels other than WhatsApp and the voice line. No CRM sync. No outbound campaigns, which
the 24 hour window makes a different product with a template approval process attached.

## Open items

None blocking. Pricing figures are gathered during the docs work rather than assumed.
