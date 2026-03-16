#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseProfileCandidates } from '../profile-selector.mjs';

const PROVIDER = 'openai-codex';
const AUTH_PATH = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
const PROBE_URL = 'https://api.openai.com/v1/models?limit=1';
const PROBE_TIMEOUT_MS = Number(process.env.CODEX_PROBE_TIMEOUT_MS || 5000);
const ENABLE_PROBE = process.env.CODEX_ROTATE_PROBE !== '0'; // default ON

function loadAuth() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
}

function saveAuth(data) {
  fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2) + '\n');
}

const HEALTHY_PRIORITY = [
  `${PROVIDER}:team1`,
  `${PROVIDER}:team2`,
  `${PROVIDER}:team3`,
];

function scoreProfile(id, auth, now) {
  const profile = auth.profiles?.[id];
  const stats = auth.usageStats?.[id] || {};
  if (!profile) return { id, score: -9999, reason: 'missing' };

  const expired = typeof profile.expires === 'number' && profile.expires <= now;
  const disabledUntil = Number(stats.disabledUntil || 0);
  const cooldownUntil = Number(stats.cooldownUntil || 0);
  const disabled = disabledUntil > now;
  const cooling = cooldownUntil > now;

  let score = 0;
  const healthyIdx = HEALTHY_PRIORITY.indexOf(id);
  if (healthyIdx >= 0 && !disabled) score += 300 - healthyIdx * 20;

  if (!expired) score += 50;
  if (!disabled) score += 40;
  if (!cooling) score += 20;

  const err = Number(stats.errorCount || 0);
  score -= Math.min(err, 50);

  const lastUsed = Number(stats.lastUsed || 0);
  if (lastUsed > 0) score += Math.min((now - lastUsed) / (1000 * 60 * 60), 8);

  return {
    id,
    score,
    reason: `${healthyIdx >= 0 ? `healthy#${healthyIdx + 1} ` : ''}${expired ? 'expired ' : ''}${disabled ? 'disabled ' : ''}${cooling ? 'cooldown ' : ''}err=${err}`.trim(),
    profile,
  };
}

async function probeProfileOAuth(id, profile) {
  const access = profile?.access;
  if (!access) return { id, ok: false, kind: 'no_access' };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort('timeout'), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${access}` },
      signal: ac.signal,
    });

    if (res.ok) return { id, ok: true, kind: 'ok', status: res.status };

    if (res.status === 401 || res.status === 403) return { id, ok: false, kind: 'auth', status: res.status };
    if (res.status === 429) return { id, ok: false, kind: 'rate_limit', status: res.status };
    if (res.status >= 500) return { id, ok: false, kind: 'server', status: res.status };
    return { id, ok: false, kind: 'http', status: res.status };
  } catch (e) {
    return { id, ok: false, kind: String(e).includes('timeout') ? 'timeout' : 'network' };
  } finally {
    clearTimeout(t);
  }
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
    } else if (p.kind === 'rate_limit') {
      s.score -= 120;
    } else if (p.kind === 'timeout' || p.kind === 'network' || p.kind === 'server') {
      s.score -= 80;
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
      // serialize to avoid burst/429 amplification
      probeResults.push(await probeProfileOAuth(s.id, s.profile));
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
