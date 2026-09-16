import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';

type Counts = { contacts: number; messages: number; hot: number };

// dist/web/status.js sits two levels below the repo root, and so does
// src/web/status.ts when running under tsx. Same relative path either way.
const PAGE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'index.html');

export function registerStatusRoutes(app: Express, counts: () => Promise<Counts>) {
  app.get('/', async (_req, res) => {
    try {
      res.type('html').send(await readFile(PAGE, 'utf8'));
    } catch {
      res.status(500).send('Status page missing. Is web/index.html still in the repo?');
    }
  });

  app.get('/api/stats', async (_req, res) => {
    try {
      res.json(await counts());
    } catch (error) {
      // 503 rather than 500: the app is fine, its database is not, and the page
      // says exactly that instead of showing a green dot over stale numbers.
      res.status(503).json({ error: (error as Error).message });
    }
  });
}
