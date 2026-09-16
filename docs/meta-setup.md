# Meta setup

This is the part people get stuck on. Work through it in order.

You need a Facebook account and a Meta business account. Personal accounts work
to start with, but business verification later needs a real business.

## 1. Create the app

Go to developers.facebook.com, My Apps, Create App. Pick the type that offers
WhatsApp. Add the WhatsApp product to it.

Meta gives you a test phone number straight away. It can only message a short
list of recipients you add by hand, which is enough to get working.

## 2. The three values you need

**Phone number id.** Under WhatsApp, API Setup. It is a long number next to the
test number. Not the phone number itself, the id underneath it. This is
`WHATSAPP_PHONE_NUMBER_ID`.

**Access token.** Same page. The temporary token there expires in 24 hours,
which is fine for the first test and will quietly break the next day. For
anything lasting, create a system user in Business Settings and generate a
permanent token with `whatsapp_business_messaging` and
`whatsapp_business_management`. This is `WHATSAPP_ACCESS_TOKEN`.

**App secret.** App Settings, Basic. It is hidden behind a Show button. This is
`WHATSAPP_APP_SECRET`, and the app will not start without it.

That last one is not optional here. It is what proves an incoming webhook really
came from Meta. Without it, anyone who finds your URL can drive your agent and
spend your model credits.

## 3. Pick a verify token

`WHATSAPP_VERIFY_TOKEN` is a string you invent. Nobody issues it. Meta sends it
back to you during webhook setup so you can confirm the request is the one you
were expecting. Any random string is fine, and it goes in `.env`.

## 4. Point Meta at your app

Your app has to be reachable over HTTPS first. Meta will not verify a webhook on
localhost. Start a tunnel:

```
npx cloudflared tunnel --url http://localhost:8080
```

Under WhatsApp, Configuration, edit the webhook. Callback URL is your public URL
with `/webhooks/whatsapp` on the end. Verify token is the string from step 3.

Click verify and save. If it fails, check in this order: the app is running, the
tunnel URL is the current one, the verify token matches exactly.

Then subscribe to the `messages` field. This is easy to miss and the symptom is
an agent that verifies fine and then never receives anything.

## 5. Test it

Add your own number to the allowed recipients list, message the test number, and
wait for a reply.

## 6. Going to production

The test number is not something you can give customers. For a real number you
need Meta business verification, which means submitting business documents and
waiting. How long varies.

Start this early. It is the step that decides when you can actually launch, and
it runs in the background while you build everything else.

Once verified, add your real number, get a new phone number id, and change
`WHATSAPP_PHONE_NUMBER_ID` in `.env`.

## What the free tier actually covers

Since July 2025 WhatsApp bills per message, and only template messages are
charged. The free-form replies this agent sends inside the 24 hour customer
service window are not charged. You start paying when you send templates, which
is what reopening a cold conversation requires.

Current figures are on
[Meta's pricing page](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
They vary by country, so read it for yours rather than trusting a number in a
blog post.
