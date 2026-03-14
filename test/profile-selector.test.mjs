import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseProfileCandidates } from '../profile-selector.mjs';

test('prefers team1/team2/team3 before default', () => {
  const out = chooseProfileCandidates();
  assert.deepEqual(out.slice(0, 4), [
    'openai-codex:team1',
    'openai-codex:team2',
    'openai-codex:team3',
    'openai-codex:default',
  ]);
});
