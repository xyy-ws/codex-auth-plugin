#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chooseProfileCandidates } from '../profile-selector.mjs';

const execFileAsync = promisify(execFile);
const PROVIDER = 'openai-codex';
const AUTH_PATH = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
const ENABLE_PROBE = process.env.CODEX_ROTATE_PROBE !== '0'; // default ON
const PROBE_TIMEOUT_MS = Number(process.env.CODEX_PROBE_TIMEOUT_MS || 20000);
const ORDER_TIMEOUT_MS = Number(process.env.CODEX_ORDER_TIMEOUT_MS || 90000);
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/root/.nvm/versions/node/v22.22.0/bin/openclaw';
const PROBE_AGENT = process.env.CODEX_PROBE_AGENT || 'planner';
const PROBE_MESSAGE = process.env.CODEX_PROBE_MESSAGE || '__codex_profile_probe__';

function loadAuth() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
}

function saveAuth(data) {
  fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2) + '\n');
}

function classifyProbeFailure(raw = '') {
  const text = String(raw).toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('rate limit') || text.includes('429') || text.includes('cooldown')) return 'rate_limit';
  if (text.includes('billing') || text.includes('insufficient') || text.includes('402')) return 'billing';
  if (text.includes('workspace deactivated') || text.includes('deactivated_workspace')) return 'workspace_deactivated';
  if (text.includes('auth') || text.includes('401') || text.includes('403') || text.includes('invalid token') || text.includes('unauthorized')) return 'auth';
  if (text.includes('timeout')) return 'timeout';
  return 'unknown';
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

async function setOrderForProbe(order) {
  let lastErr;
  for (let i = 0; i < 2; i += 1) {
    try {
      await execFileAsync(OPENCLAW_BIN, [
        'models',
        'auth',
        'order',
        'set',
        '--provider',
        PROVIDER,
        ...order,
      ], { timeout: ORDER_TIMEOUT_MS });
      return;
    } catch (e) {
      lastErr = e;
      // retry once on timeout/kill
      if (!(e?.killed || String(e?.message || '').toLowerCase().includes('timeout')) || i === 1) throw e;
    }
  }
  if (lastErr) throw lastErr;
}

async function runCodexProbe() {
  try {
    const { stdout, stderr } = await execFileAsync(
      OPENCLAW_BIN,
      ['agent', '--agent', PROBE_AGENT, '--message', PROBE_MESSAGE, '--timeout', '20', '--json'],
      { timeout: PROBE_TIMEOUT_MS }
    );
    const text = `${stdout || ''}\n${stderr || ''}`;
    const kind = classifyProbeFailure(text);
    if (kind === 'unknown') return { ok: true, kind: 'ok', raw: text.slice(0, 500) };
    if (kind === 'auth' || kind === 'rate_limit' || kind === 'billing' || kind === 'workspace_deactivated') {
      return { ok: false, kind, raw: text.slice(0, 500) };
    }
    return { ok: true, kind: 'ok', raw: text.slice(0, 500) };
  } catch (e) {
    const text = `${e?.stdout || ''}\n${e?.stderr || ''}\n${e?.message || ''}`;
    const kind = classifyProbeFailure(text);
    return { ok: false, kind, raw: text.slice(0, 500) };
  }
}

async function probeProfileOAuth(id, profile, stats, now, originalOrder) {
  if (!profile) return { id, ok: false, kind: 'missing' };
  if (!profile.access && !profile.refresh) return { id, ok: false, kind: 'no_access' };

  const expires = Number(profile.expires || 0);
  if (expires > 0 && expires <= now) return { id, ok: false, kind: 'auth' };

  try {
    await setOrderForProbe([id]);
    const res = await runCodexProbe();
    return { id, ...res };
  } finally {
    await setOrderForProbe(originalOrder);
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
    } else if (p.kind === 'billing' || p.kind === 'workspace_deactivated') {
      s.score -= 260;
    } else if (p.kind === 'rate_limit') {
      s.score -= 120;
    } else if (p.kind === 'timeout' || p.kind === 'network') {
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
  const originalOrder = [...(auth.order?.[PROVIDER] || base)];

  if (ENABLE_PROBE) {
    const probeResults = [];
    for (const s of scored) {
      const stats = auth.usageStats?.[s.id] || {};
      probeResults.push(await probeProfileOAuth(s.id, s.profile, stats, now, originalOrder));
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

  // also apply through CLI to keep agent stores aligned
  try {
    await setOrderForProbe(newOrder);
  } catch {
    // keep local save as fallback
  }

  console.log('Updated order:', newOrder.join(', '));
  console.log(`Probe mode: ${ENABLE_PROBE ? 'ON' : 'OFF'}`);
  console.log('Scores:');
  for (const s of scored) {
    console.log(`- ${s.id}: ${s.score.toFixed(1)} (${s.reason || 'ok'})`);
  }
}

main();
