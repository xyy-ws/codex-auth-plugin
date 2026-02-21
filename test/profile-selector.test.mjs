import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseProfileCandidates } from '../profile-selector.mjs';

test('includes default and team2 candidates', () => {
  const out = chooseProfileCandidates();
  assert.equal(out[0], 'openai-codex:default');
  assert.ok(out.includes('openai-codex:team2'));
});
