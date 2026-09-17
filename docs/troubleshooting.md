# When it goes quiet

Work down this list in order and stop at the first thing that is wrong. Do not
change two things at once. If you use Claude Code, `/doctor` does this with you.

## The tunnel URL changed

Check this first. It is the most common cause by a wide margin.

A free tunnel gets a new address every time you restart it. Meta is still
delivering to the old one, so everything looks fine on your side and no message
ever arrives.

Compare the callback URL in the Meta app against the URL serving right now.

## Is it running

```
curl https://agent.example.com/health
```

No answer means the process is down. `docker logs sales-agent --tail 50` says
why in the last few lines.

A missing environment variable is named exactly, because config validation runs
at boot rather than at the first customer message. An empty `knowledge/` folder
is the other common one, and the message says which folder.

## Is the database reachable

Load the status page. A red dot means the app is up but Supabase is not
answering, or the keys are wrong. Check `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` against Project Settings, API.

## Is Meta delivering at all

In the Meta app, under Webhooks, look at recent deliveries.

Nothing listed means the problem is on Meta's side of the line. Usually the
`messages` field was never subscribed, which is easy to miss because webhook
verification passes without it.

## Everything returns 401

That is signature verification failing, which means `WHATSAPP_APP_SECRET` does
not match the app secret in Meta. Copy it again from App Settings, Basic, behind
the Show button.

It is meant to fail this way. There is no configuration that makes the agent
accept an unsigned request.

## It is refusing to reply on purpose

Look for a log line about the daily cap or the per-contact limit.

If the daily cap was hit, either `DAILY_MESSAGE_CAP` is too low for your real
traffic, or something is looping. Check which before raising it.

## It has gone quiet for one contact only

Check `handoff_until` on that row in `contacts`. Someone asked for a person, so
the agent stepped back. It resumes by itself when that timestamp passes. To
bring it back now, set the column to null.

## The reply failed to send

Look for a line mentioning 24 hours. That is error 131047 and it is not a bug.
More than a day has passed since that person last wrote to you, so a free-form
reply is not allowed. They have to message first, or you need an approved
template.

## The model is not answering

A failure with any other code, or an error naming your model provider, means
`AI_API_KEY`, `AI_MODEL` or `AI_API_BASE_URL` is wrong. A model name that does
not exist on the provider returns a 404 that reads like a routing problem.

## It replied twice

It should not be able to. Every message id is claimed in `processed_messages`
before a reply is generated. If duplicates appear, check that table exists and
that `supabase/schema.sql` was run in full rather than partly.
