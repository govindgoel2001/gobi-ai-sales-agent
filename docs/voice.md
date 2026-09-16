# The voice line

Off by default. Turn it on once chat works.

It is off by default for two reasons. It needs a paid Twilio number, so it is
the first thing in this build that costs money before you have a customer. And
it bills per minute of call on top of that, from the realtime model, so a
looping or abandoned call is a live meter.

## How it works

Twilio answers the call and opens a media stream to `/voice/media`. The app
bridges that stream to the OpenAI Realtime API in both directions. The caller
hears the model, the model hears the caller.

Both sides of the conversation are transcribed and stored in the same `messages`
table as chat, with `channel` set to `voice`. So someone who phones and then
messages later is one contact with one history, which is the point.

## Setup

Buy a Twilio number with voice capability.

In `.env`:

```
VOICE_ENABLED=true
OPENAI_API_KEY=your-key
```

`PUBLIC_BASE_URL` needs to be set to your real HTTPS URL, because the TwiML has
to tell Twilio which host to open the media stream against.

In the Twilio console, set the number's voice webhook to
`https://agent.example.com/voice/incoming`.

Restart the app and call the number.

## What the agent knows on a call

The same `knowledge/` folder as chat, with the same rule about not inventing
anything. It is told to offer a callback from a person rather than guess.

## If it does not work

The app refuses to start when `VOICE_ENABLED=true` and `OPENAI_API_KEY` is
blank. That is deliberate, and the error says so.

A call that connects and then goes silent usually means `PUBLIC_BASE_URL` is
wrong or missing, so Twilio is trying to open a stream against a host that is
not you.

Nothing stored after a call means the caller number did not arrive. Twilio does
not put it on the media stream by itself, so the TwiML passes it through as a
stream parameter. If you edited that TwiML, put it back.
