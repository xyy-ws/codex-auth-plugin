import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyFailure,
  chooseProfile,
  shouldCooldown,
} from '../src/failover.mjs';

test('classifyFailure detects billing/quota errors', () => {
  const msg = 'API provider billing error: insufficient_quota balance exhausted';
  assert.equal(classifyFailure(msg), 'quota');
});

test('classifyFailure detects rate_limit/cooldown errors', () => {
  const msg = 'provider is in cooldown (rate_limit)';
  assert.equal(classifyFailure(msg), 'rate_limit');
});

test('classifyFailure detects deactivated workspace errors', () => {
  const msg = '{"detail":{"code":"deactivated_workspace"}}';
  assert.equal(classifyFailure(msg), 'workspace_deactivated');
});

test('shouldCooldown returns true for quota/rate_limit/workspace_deactivated', () => {
  assert.equal(shouldCooldown('quota'), true);
  assert.equal(shouldCooldown('rate_limit'), true);
  assert.equal(shouldCooldown('workspace_deactivated'), true);
  assert.equal(shouldCooldown('other'), false);
});

test('chooseProfile switches from primary to backup when primary is cooling down', () => {
  const now = Date.parse('2026-02-20T13:00:00Z');
  const state = {
    cooldowns: {
      teamA: now + 30 * 60 * 1000,
    },
  };

  const result = chooseProfile({
    orderedProfiles: ['teamA', 'teamB'],
    state,
    now,
  });

  assert.equal(result.profile, 'teamB');
  assert.equal(result.reason, 'primary_cooling_down');
});

test('chooseProfile returns primary when cooldown expired', () => {
  const now = Date.parse('2026-02-20T13:00:00Z');
  const state = {
    cooldowns: {
      teamA: now - 1000,
    },
  };

  const result = chooseProfile({
    orderedProfiles: ['teamA', 'teamB'],
    state,
    now,
  });

  assert.equal(result.profile, 'teamA');
  assert.equal(result.reason, 'primary_ready');
});
