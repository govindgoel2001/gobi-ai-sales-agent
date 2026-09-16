# AI sales agent

This repo runs a sales agent that answers WhatsApp messages for one business.
It is meant to be set up by talking to Claude Code rather than by reading a
wiki, so the four skills below do the work.

## Skills

`/setup` takes someone from a fresh clone to a real reply on their own phone.
`/knowledge` interviews the owner and writes the files the agent answers from.
`/deploy` puts it on a VPS behind TLS and keeps it running.
`/doctor` works out why a running agent has gone quiet.

Run `/setup` first. The others assume it finished.

## What the agent knows

Everything the agent can tell a customer lives in `knowledge/` as markdown.
There is no BUSINESS_CONTEXT variable. Files load at boot, so a change to them
needs a restart, and the total is capped by KNOWLEDGE_MAX_TOKENS.

If a fact is not in those files, the agent is instructed to say it does not know
and offer a human. That is deliberate. Do not loosen it to make the agent sound
more helpful.

## Rules when working in here

Never write a real secret into a file that git tracks. `.env` is ignored,
`.env.example` is not, and the difference matters.

The webhook has no unsigned path. If a change would let a request through
without a valid signature, it is wrong, whatever it fixes.

Do not add a dependency without saying why in the commit message. This repo is
cloned by people who will not audit it.

Prose in this repo uses no em dashes and no en dashes, sentence case headings,
and no pricing figure that was not read off a live pricing page.
