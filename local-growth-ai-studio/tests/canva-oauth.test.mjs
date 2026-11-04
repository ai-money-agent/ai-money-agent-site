import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvaOAuthStore } from '../lib/canva-oauth.js';

test('stores one-time OAuth state and encrypts account tokens', () => {
  const store = new CanvaOAuthStore(':memory:', Buffer.alloc(32, 7).toString('base64'));
  try {
    const state = 'state-value-that-is-long-enough-to-be-unique';
    const verifier = 'verifier-value-for-the-pkce-authorization-flow';
    store.createState(state, 'beta-owner', verifier);
    assert.deepEqual(store.consumeState(state), { account: 'beta-owner', verifier });
    assert.equal(store.consumeState(state), null);
    assert.equal(store.hasToken('beta-owner'), false);

    const token = { accessToken: 'access-secret', refreshToken: 'refresh-secret', expiresAt: 1234 };
    store.saveToken('beta-owner', token);
    assert.equal(store.hasToken('beta-owner'), true);
    assert.deepEqual(store.getToken('beta-owner'), token);
    assert.equal(store.hasToken('other-account'), false);
  } finally {
    store.close();
  }
});

test('rejects token persistence without a valid encryption key', () => {
  const store = new CanvaOAuthStore(':memory:', 'invalid');
  try {
    assert.equal(store.ready(), false);
    assert.throws(() => store.saveToken('beta-owner', { accessToken: 'secret' }), /CANVA_TOKEN_ENCRYPTION_KEY/);
  } finally {
    store.close();
  }
});
