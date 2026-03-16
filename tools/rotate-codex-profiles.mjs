#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseProfileCandidates } from '../profile-selector.mjs';

const PROVIDER = 'openai-codex';
const AUTH_PATH = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
const ENABLE_PROBE = process.env.CODEX_ROTATE_PROBE !== '0'; // default ON

function loadAuth() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
}

function saveAuth(data) {
  fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2) + '\n');
}

function scoreProfile(id, auth, now) {
  const profile = auth.profiles?.[id];
  const stats = auth.usageStats?.[id] || {};
  if (!profile) return { id, score: -9999, reason: 'missing' };

  const expired = typeof profile.expires === 'number' && profile.expires <= now;
  const disabledUntil = Number(stats.disabledUntil || 0);
  const cooldownUntil = Number(stats.cooldownUntil || 0);
  const disabled = disabledUntil > now;
  const cooling = cooldownUntil > now;

  // 探针模式下，基础分只保留轻量兜底，不再做人为健康队列加权
  let score = 0;
  if (!expired) score += 10;
  if (!disabled) score += 10;
  if (!cooling) score += 5;

  const err = Number(stats.errorCount || 0);
  score -= Math.min(err, 20);

  return {
    id,
    score,
    reason: `${expired ? 'expired ' : ''}${disabled ? 'disabled ' : ''}${cooling ? 'cooldown ' : ''}err=${err}`.trim(),
    profile,
  };
}

async function probeProfileOAuth(id, profile, stats, now) {
  // Codex OAuth-native probe (no direct OpenAI API call):
  // evaluate auth store semantics the same way OpenClaw uses profile usability.
  if (!profile) return { id, ok: false, kind: 'missing' };

  const expires = Number(profile.expires || 0);
  const disabledUntil = Number(stats?.disabledUntil || 0);
  const cooldownUntil = Number(stats?.cooldownUntil || 0);
  const disabledReason = String(stats?.disabledReason || '');

  if (!profile.access && !profile.refresh) return { id, ok: false, kind: 'no_access' };
  if (expires > 0 && expires <= now) return { id, ok: false, kind: 'auth' };
  if (disabledUntil > now && (disabledReason === 'billing' || disabledReason === 'workspace_deactivated')) {
    return { id, ok: false, kind: disabledReason };
  }
  if (cooldownUntil > now) return { id, ok: false, kind: 'rate_limit' };

  return { id, ok: true, kind: 'ok' };
}

function applyProbeAdjustment(scored, probeResults) {
  const byId = new Map(probeResults.map((x) => [x.id, x]));
  for (const s of scored) {
    const p = byId.get(s.id);
    if (!p) continue;

    if (p.ok) {
      s.score += 120;
      s.reason = `${s.reason} probe=ok`;
      continue;
    }

    if (p.kind === 'auth') {
      s.score -= 500;
    } else if (p.kind === 'billing' || p.kind === 'workspace_deactivated') {
      s.score -= 260;
    } else if (p.kind === 'rate_limit') {
      s.score -= 120;
    } else {
      s.score -= 40;
    }
    s.reason = `${s.reason} probe=${p.kind}`;
  }
}

async function main() {
  if (!fs.existsSync(AUTH_PATH)) {
    console.error(`Auth file not found: ${AUTH_PATH}`);
    process.exit(1);
  }

  const auth = loadAuth();
  const now = Date.now();
  const known = Object.keys(auth.profiles || {}).filter((k) => k.startsWith(`${PROVIDER}:`));
  const base = chooseProfileCandidates(known);

  const scored = base.map((id) => scoreProfile(id, auth, now));

  if (ENABLE_PROBE) {
    const probeResults = [];
    for (const s of scored) {
      const stats = auth.usageStats?.[s.id] || {};
      probeResults.push(await probeProfileOAuth(s.id, s.profile, stats, now));
    }
    applyProbeAdjustment(scored, probeResults);
  }

  scored.sort((a, b) => b.score - a.score);
  const newOrder = scored.map((x) => x.id);

  auth.order ||= {};
  auth.order[PROVIDER] = newOrder;

  auth.lastGood ||= {};
  if (!newOrder.includes(auth.lastGood[PROVIDER])) {
    auth.lastGood[PROVIDER] = newOrder[0];
  }

  saveAuth(auth);

  console.log('Updated order:', newOrder.join(', '));
  console.log(`Probe mode: ${ENABLE_PROBE ? 'ON' : 'OFF'}`);
  console.log('Scores:');
  for (const s of scored) {
    console.log(`- ${s.id}: ${s.score.toFixed(1)} (${s.reason || 'ok'})`);
  }
}

main();
