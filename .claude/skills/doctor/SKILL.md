---
name: doctor
description: Work out why the agent has stopped replying. Use when messages get no answer, or when Meta will not verify the webhook.
---

# Doctor

Work down this list in order and stop at the first thing that is wrong. Do not
change two things at once.

Report what you find in plain words. The person asking usually cannot read a
stack trace.

## 1. Is it running

Hit `/health`. Locally that is `curl localhost:8080/health`, on a server it is
the public URL.

No answer means the process is down. `docker logs sales-agent --tail 50` will
usually say why in the last few lines. The most common causes are a missing env
var, which the config check names exactly, and an empty `knowledge/` folder.

## 2. Can it reach the database

Load the status page. A red dot means Supabase is unreachable or the keys are
wrong. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY against the project
settings page.

## 3. Is Meta still pointed at the right place

The single most common cause of an agent going quiet is a tunnel URL that
changed. A free tunnel gets a new address every restart, and Meta is still
delivering to the old one.

Check the callback URL in the Meta app against the URL that is actually serving
right now.

## 4. Is Meta delivering at all

In the Meta app, under Webhooks, look at recent deliveries. Nothing there means
the problem is on Meta's side of the line: usually the `messages` field is not
subscribed, or the number is not connected to this app.

## 5. Are requests being refused

Look in the logs for 401s. That is the signature failing, which means
WHATSAPP_APP_SECRET does not match the app secret in Meta. Copy it again. It is
under App Settings, Basic, and it is hidden behind a Show button.

## 6. Is it refusing to reply on purpose

Look for a log line about the daily cap or the per-contact limit. If the cap was
hit, DAILY_MESSAGE_CAP is too low for their traffic, or something is looping.
Check whether the agent is somehow answering itself before raising it.

## 7. Did the reply fail to send

Look for a line mentioning 24 hours. That is error 131047, and it is not a bug:
more than a day has passed since that person last wrote, so a free-form reply is
not allowed. They have to write first, or the business needs an approved
template. Explain that rather than trying to fix it.

## 8. Is the model answering

A send failure with a different code, or an error from the model provider, means
AI_API_KEY, AI_MODEL or AI_API_BASE_URL is wrong. A model name that does not
exist on the provider gives a 404 that reads like a routing problem.

## 9. Is it answering the same message twice

It should not be able to. Every message id is claimed in `processed_messages`
before any reply is generated. If duplicates are appearing, check that table
exists and that the schema was run in full.
