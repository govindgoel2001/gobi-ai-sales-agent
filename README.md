# AI sales agent

A WhatsApp sales agent for one business. It answers questions from a folder of
markdown you write, remembers every contact and conversation in Supabase, scores
leads as they get warmer, hands over to a human when someone asks for one, and
optionally answers a phone line.

You set it up by talking to Claude Code. Clone the repo, run `/setup`, answer
the questions.

## Read this before you start

Two things will shape what you can build, and both come from Meta rather than
from this code.

**Replies only work inside a 24 hour window.** Once someone messages you, you
can reply freely for 24 hours. After that, a free-form message is refused and
the only way to reopen the conversation is an approved message template. So the
agent is genuinely 24/7 for anyone who writes to it, and it cannot chase someone
who went quiet three days ago. If you want outbound follow-ups, that is a
different product with a template approval process attached.

**Production access needs Meta business verification.** Until that clears, your
number can only talk to a handful of test recipients you list by hand. It is not
instant. Start it on day one, not on the day you want to launch.

## Quickstart

```
git clone https://github.com/govindgoel2001/gobi-ai-sales-agent
cd gobi-ai-sales-agent
npm install
claude
```

Then type `/setup` and follow it. It walks through Supabase, the Meta app, your
env file, a tunnel so Meta can reach your laptop, and a first real message to
your own phone.

Not using Claude Code? The same steps are in `docs/meta-setup.md` and
`docs/deploy-vps.md`, written to be followed by hand.

## What it costs

Numbers here change and vary by country, so this lists what you pay for and
links the page that has the current figure. Check them yourself.

WhatsApp charges per message, and since July 2025 only template messages are
charged. Everything this agent normally sends is a free-form reply inside the
customer service window, and those are free. You would only start paying Meta if
you added templates to reopen cold conversations.
[Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

Your model provider bills per token, and every reply sends your whole
`knowledge/` folder plus recent conversation history. That is why the folder has
a token budget. Check your provider's pricing page.

Supabase has a free tier that is enough for this.
[Pricing](https://supabase.com/pricing)

A VPS is the only fixed monthly cost, and the smallest one any provider sells is
enough.

Voice, if you turn it on, needs a paid Twilio number plus realtime model usage
billed per minute of call. It is off by default.
[Twilio pricing](https://www.twilio.com/en-us/voice/pricing)

## How it works

A message arrives at `/webhooks/whatsapp`. The signature is checked against your
app secret, and a request that fails is refused before anything else happens.
The webhook is acknowledged immediately, because Meta retries anything slow.

The message id is then claimed in a `processed_messages` table. A retry finds
the id already there and stops, so a hiccup on Meta's side never produces two
replies or two model calls.

After that the contact is found or created, the message is stored, the lead is
scored, and a reply is generated from your knowledge files and the last few
turns of conversation. If the send fails it is stored as failed rather than
logged and forgotten.

## What the agent knows

Everything it can say lives in `knowledge/` as markdown. Write plainly. The
model reads it, not a customer.

Files load at boot, so changing them needs a restart. The total is capped by
`KNOWLEDGE_MAX_TOKENS`, and if you go over it the app refuses to start and names
the file that broke the limit rather than quietly truncating it.

If a fact is not in those files, the agent says it does not know and offers a
human. Do not loosen that to make it sound more helpful. An agent that invents a
delivery date has made a promise to a real customer.

## Handing over to a person

When someone asks for a human, or mentions a refund, complaint or anything
legal, the agent says once that it is passing the thread over and then goes
quiet so the human can talk without it interrupting.

That silence expires after `HANDOFF_HOURS`, 24 by default, and the agent starts
answering again by itself. A handoff that never lifts is a contact the agent is
permanently dead for, which is worse than one you forgot to pick up.

## Lead scores

Scores go up on buying signals and decay by roughly ten points a day of silence.
The decay matters: a score that only ever climbs is a message counter, and after
a month everyone reads as hot and the number stops being worth looking at.

## Spend guards

`DAILY_MESSAGE_CAP` bounds replies across every conversation in a rolling 24
hours. A per-contact bucket stops one person messaging faster than a person can
type. When either trips, the agent stops replying and says so in the log rather
than degrading quietly.

## What this is not

It is not multi-tenant. One deployment serves one business.

It does not do outbound campaigns, for the window reason above.

It does not sync to a CRM. The data is in your own Supabase project and it is
yours to query.

## Docs

`docs/meta-setup.md`, the Meta app, tokens and verification.
`docs/deploy-vps.md`, Docker, Caddy and keeping it up.
`docs/voice.md`, the optional phone line.
`docs/company-brain.md`, generating knowledge from a company brain.
`docs/troubleshooting.md`, what to check when it goes quiet.

## Licence

MIT. See `LICENSE`.
