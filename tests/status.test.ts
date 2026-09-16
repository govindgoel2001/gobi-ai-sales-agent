import express from 'express';
import { describe, expect, it } from 'vitest';
import { registerStatusRoutes } from '../src/web/status.js';
import { fetch_app } from './http.js';

function appWith(counts = { contacts: 12, messages: 340, hot: 3 }) {
  const app = express();
  registerStatusRoutes(app, async () => counts);
  return app;
}

describe('status routes', () => {
  it('serves the page at the root', async () => {
    const res = await fetch_app(appWith(), '/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<!doctype html>');
  });

  it('serves the counts as json', async () => {
    const res = await fetch_app(appWith(), '/api/stats');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text)).toEqual({ contacts: 12, messages: 340, hot: 3 });
  });

  it('reports a database problem rather than a blank page', async () => {
    const app = express();
    registerStatusRoutes(app, async () => { throw new Error('connection refused'); });
    const res = await fetch_app(app, '/api/stats');
    expect(res.status).toBe(503);
  });

  it('does not require a query string to know where to look', async () => {
    const res = await fetch_app(appWith(), '/');
    expect(res.text).not.toContain('URLSearchParams');
    expect(res.text).toContain('/api/stats');
  });
});
