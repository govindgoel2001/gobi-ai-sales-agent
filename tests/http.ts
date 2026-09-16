import { createServer, type Server } from 'node:http';
import type { Express } from 'express';

async function withServer<T>(app: Express, run: (base: string) => Promise<T>): Promise<T> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export function fetch_app(app: Express, path: string) {
  return withServer(app, async (base) => {
    const res = await fetch(base + path);
    return { status: res.status, text: await res.text() };
  });
}

export function post_app(app: Express, path: string, body: string, signature: string | undefined) {
  return withServer(app, async (base) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signature) headers['x-hub-signature-256'] = signature;
    const res = await fetch(base + path, { method: 'POST', headers, body });
    return { status: res.status, text: await res.text() };
  });
}
