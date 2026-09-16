# Build a 24/7 AI sales agent on WhatsApp

By the end of this you will have a WhatsApp number that answers your customers
from your own prices and policies, remembers everyone who has ever messaged it,
flags the people who sound ready to buy, and hands over to you when someone asks
for a person. Optionally it answers a phone line too.

Repo: https://github.com/govindgoel2001/gobi-ai-sales-agent

## Two things nobody tells you first

I would rather you know these now than find out at step nine.

**You can only reply freely for 24 hours.** Once a customer messages you, you
can talk normally for a day. After that WhatsApp refuses your message and the
only way back in is a pre-approved template. So this agent answers 24/7 for
anyone who writes to it. It cannot chase a lead who went cold last week. Anyone
selling you an "AI that follows up forever" on WhatsApp is either using
templates or has not shipped it.

**A real number needs Meta business verification.** You get a test number
immediately, and it only talks to a handful of contacts you list by hand. That
is fine for building. Going live means submitting business documents to Meta and
waiting. Start that on day one so it is running while you build.

## What it costs to run

Less than people assume.

WhatsApp bills per message, and only template messages are charged. Everything
this agent normally sends is a free-form reply inside that 24 hour window, so
Meta charges nothing for it.

Supabase has a free tier that comfortably covers this.

Your model API bills per token, and that is your real running cost.

A small VPS is the only fixed monthly bill.

Voice is the expensive one, because it needs a paid Twilio number and bills per
minute of call. It is off by default and you should leave it off until chat
works.

## The build

```
git clone https://github.com/govindgoel2001/gobi-ai-sales-agent
cd gobi-ai-sales-agent
npm install
claude
```

Then type `/setup`.

That skill does the whole thing with you, one step at a time, checking each
before moving on. Supabase project and schema. Meta app, app secret, access
token, phone number id. Your `.env`. A tunnel so Meta can reach your laptop. A
first real message from your own phone.

It never asks you to paste a secret into the chat. It tells you which file and
which line.

## Teaching it your business

Run `/knowledge`.

It interviews you. What you sell, what it costs, where you are, what people ask
you over and over, what you do not do, what should happen when someone wants to
buy. Then it writes that into `knowledge/` as plain markdown files you can edit
in Notepad.

That folder is everything the agent is allowed to say. If a fact is not in
there, it says it does not know and offers you. That is deliberate and you
should not loosen it. An agent that invents a delivery date has made a promise
to a real customer on your behalf.

## Putting it live

Run `/deploy`.

Docker on a VPS, Caddy in front for HTTPS, restart on reboot, then point Meta at
the real URL instead of the tunnel. The tunnel dies when you close your laptop,
which is the thing that confuses everyone the first time.

## When it breaks

Run `/doctor`.

It checks whether the process is up, whether the database is reachable, whether
Meta is still pointed at the right URL, whether the `messages` field is actually
subscribed, and whether the agent is refusing to reply on purpose because a
spend cap tripped. Then it tells you which one it is in plain words.

Nine times out of ten it is the tunnel URL changing.

## What I would build next

Templates, so you can reopen a cold conversation. That is the one real
limitation in the list above, and it is a separate piece of work because every
template needs Meta's approval before you can send it.
