---
name: setup
description: Take this repo from a fresh clone to a working WhatsApp agent replying on the owner's own phone. Use when someone has just cloned it or when setup was never finished.
---

# Setup

Work through these in order and confirm each one before moving on. Do not batch
them. The person you are helping may never have used a terminal.

Never ask anyone to paste a secret into the chat. Tell them which file to put it
in and which line.

## 1. Check the machine

Run `node --version`. It must be 20 or higher. If it is lower or missing, stop
and point them at nodejs.org, then start again.

Run `npm install`.

## 2. Supabase

Ask whether they have a Supabase project. If not, walk them to supabase.com, a
new project, and the free tier.

They need two values from Project Settings, API: the project URL and the service
role key. Tell them the service role key bypasses every access rule, so it goes
in `.env` and nowhere else, ever.

Have them run the contents of `supabase/schema.sql` in the SQL editor. Confirm
that `contacts`, `messages` and `processed_messages` all appear in the table
list before continuing.

## 3. The env file

`cp .env.example .env`, then fill it in together.

WHATSAPP_VERIFY_TOKEN is any random string they invent. It is not issued by
anyone. They will paste the same string into Meta later.

WHATSAPP_APP_SECRET, WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID all come
from the Meta step below, so leave them blank for now.

AI_API_KEY is their model provider key.

BUSINESS_NAME is the name customers know them by.

## 4. Meta

Follow `docs/meta-setup.md` with them. It exists so this skill does not have to
repeat it. Come back when they have the app secret, an access token, and the
phone number id, and those three are in `.env`.

## 5. Knowledge

Run the `/knowledge` skill. The agent will not start without at least one
markdown file in `knowledge/`.

## 6. A public URL

Meta will not deliver to localhost. Start the app with `npm run dev`, then in a
second terminal start a tunnel. Cloudflare Tunnel is free and needs no account
for a quick test:

    npx cloudflared tunnel --url http://localhost:8080

Copy the https URL it prints.

Open that URL in a browser. They should see the status page with a green dot. If
the dot is red, the app cannot reach Supabase, so go back to step 2.

## 7. Point Meta at it

In the Meta app, under WhatsApp, Configuration, set the callback URL to the
tunnel URL with `/webhooks/whatsapp` on the end, and the verify token to the
string from step 3. Click verify and save. Subscribe to the `messages` field.

If verification fails, the app is not running, the tunnel has moved, or the
verify token does not match. Check all three in that order.

## 8. Prove it

Have them message their WhatsApp test number from their own phone and wait for a
reply. If nothing comes back, run the `/doctor` skill.

Once a reply arrives, setup is done. Tell them the tunnel URL dies when they
close that terminal, and that `/deploy` is the next step when they want it to
stay up.
