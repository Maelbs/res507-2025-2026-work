import test from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';

test('GET /health responds with { ok: true }', async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { ok: true });
  } finally {
    await app.close();
  }
});

test('GET /unknown-route responds with 404 Not Found', async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/cette-route-n-existe-pas'
    });

    assert.strictEqual(response.statusCode, 404);
  } finally {
    await app.close();
  }
});