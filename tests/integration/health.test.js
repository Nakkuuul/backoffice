import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';

/**
 * Smoke test for the liveness probe. Boots the app on an ephemeral port,
 * issues a real HTTP request, and asserts the response.
 */
test('GET /api/v1/health/live returns ok', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/live`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    server.close();
  }
});
