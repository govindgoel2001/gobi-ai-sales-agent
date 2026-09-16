import type { Express, Request, Response } from 'express';
import type { Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { config } from '../config.js';
import { getOrCreateContact, saveMessage } from '../db/supabase.js';
import type { Direction } from '../types.js';

/**
 * Both sockets carry frames from somewhere else, and an unguarded JSON.parse
 * inside a ws handler throws where nothing catches it, which takes the whole
 * process down and drops every conversation in flight, not just the call.
 */
export function safeParse<T>(raw: unknown): T | null {
  if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return null;
  try {
    const parsed = JSON.parse(raw.toString());
    return parsed !== null && typeof parsed === 'object' ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function voiceInstructions(knowledge: string) {
  return `You are the phone voice agent for ${config.BUSINESS_NAME}. Be concise, friendly, accurate, and sales-oriented without pressure. Never invent business facts. If something is not in the facts below, say you do not know and offer to have a person call back.

BUSINESS FACTS:
${knowledge}`;
}

export function registerVoiceRoutes(app: Express, server: Server, knowledge: string) {
  app.all('/voice/incoming', (req: Request, res: Response) => {
    if (!config.VOICE_ENABLED) return res.status(404).send('Voice is disabled');
    const host = config.PUBLIC_BASE_URL ? new URL(config.PUBLIC_BASE_URL).host : req.headers.host;

    // Twilio does not put the caller on the media stream, so it is passed
    // through as a stream parameter. Without it a call cannot be attached to a
    // contact and the transcript has nowhere to go.
    const from = String((req.body?.From ?? req.query?.From ?? '') as string).replace(/[^+\d]/g, '');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say>Please wait while I connect you to the AI sales assistant.</Say>\n  <Connect><Stream url="wss://${host}/voice/media"><Parameter name="From" value="${from}" /></Stream></Connect>\n</Response>`;
    res.type('text/xml').send(twiml);
  });

  if (!config.VOICE_ENABLED) return;
  if (!config.OPENAI_API_KEY) throw new Error('VOICE_ENABLED=true requires OPENAI_API_KEY');

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url ?? '/', `http://${request.headers.host}`).pathname;
    if (pathname !== '/voice/media') return;
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  wss.on('connection', (twilioWs) => {
    let streamSid = '';
    let caller = '';

    /**
     * Writes a call turn to the same tables chat uses, so "remembers every
     * lead" is true of calls too. Failures here must never interrupt a live
     * call, so they are logged and dropped.
     */
    async function remember(direction: Direction, text: string) {
      if (!caller || !text.trim()) return;
      try {
        const contact = await getOrCreateContact(caller, null);
        await saveMessage(contact.id, direction, text, 'voice', 'sent');
      } catch (error) {
        console.error('Could not store a voice turn:', error);
      }
    }

    const openAiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.OPENAI_REALTIME_MODEL)}`,
      { headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` } }
    );

    openAiWs.on('open', () => {
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: config.OPENAI_REALTIME_MODEL,
          output_modalities: ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              turn_detection: { type: 'server_vad' },
              // Without this there is no text to store, so the call would be
              // remembered as having happened and not as what was said.
              transcription: { model: 'whisper-1' }
            },
            output: { format: { type: 'audio/pcmu' }, voice: config.OPENAI_REALTIME_VOICE }
          },
          instructions: voiceInstructions(knowledge)
        }
      }));
    });

    openAiWs.on('message', (data) => {
      const event = safeParse<any>(data);
      if (!event) return;

      if (event.type === 'response.output_audio.delta' && event.delta && streamSid) {
        twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: event.delta } }));
      }
      if (event.type === 'input_audio_buffer.speech_started' && streamSid) {
        twilioWs.send(JSON.stringify({ event: 'clear', streamSid }));
      }
      if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
        void remember('inbound', String(event.transcript));
      }
      if (event.type === 'response.output_audio_transcript.done' && event.transcript) {
        void remember('outbound', String(event.transcript));
      }
    });

    twilioWs.on('message', (data) => {
      const event = safeParse<any>(data);
      if (!event) return;

      if (event.event === 'start') {
        streamSid = event.start?.streamSid ?? '';
        caller = event.start?.customParameters?.From ?? event.start?.from ?? '';
      }
      if (event.event === 'media' && openAiWs.readyState === WebSocket.OPEN) {
        openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: event.media?.payload }));
      }
    });

    twilioWs.on('close', () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    });
    openAiWs.on('error', (error) => console.error('OpenAI Realtime WebSocket error', error));
  });
}
