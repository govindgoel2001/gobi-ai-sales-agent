---
name: knowledge
description: Interview the owner about their business and write the markdown files the agent answers from. Use during setup, or whenever prices, hours or policies change.
---

# Knowledge

Everything the agent can say lives in `knowledge/` as markdown. Your job is to
fill it from a conversation, because an empty folder is where most people stop.

The folder ships with example files about a barber shop. Delete them once you
have real ones. Do not leave both.

## How to interview

One question at a time. Short questions. Let them ramble and write down the
specifics, because specifics are the whole value here.

Cover, in roughly this order:

What do you actually sell, in the words a customer would use.

What does it cost. Get real numbers. If they say "it depends", find out what it
depends on and write that down instead of a number.

Where are you and when are you open.

What do people ask you over and over. This is the most valuable question in the
list, so do not rush past it.

What do you not do. An agent that knows the boundary stops inventing past it.

What should happen when someone wants to buy. A booking link, a phone number, a
human.

## How to write it

One topic per file, numbered so the order is theirs: `01-what-we-sell.md`,
`02-prices.md`, and so on.

Plain sentences. No marketing voice. The model reads this, not a customer.

Write only what they told you. If you find yourself filling a gap with something
plausible, stop and ask instead. An invented delivery time becomes a promise the
agent makes to a real customer.

## When you are done

Restart the app and check it starts. Files load at boot, so nothing changes
until it restarts.

If it refuses to start with a budget error, it names the file that broke the
limit. Trim that file, or raise KNOWLEDGE_MAX_TOKENS in `.env` if the content is
genuinely all needed.
