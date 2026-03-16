#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chooseProfileCandidates } from '../profile-selector.mjs';

const PROVIDER = 'openai-codex';
const AUTH_PATH = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');

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
  // 强优先：用户指定健康队列 team1/team2/team3（仅在未禁用时）
  const healthyIdx = HEALTHY_PRIORITY.indexOf(id);
  if (healthyIdx >= 0 && !disabled) score += 300 - healthyIdx * 20;

  if (!expired) score += 50;
  if (!disabled) score += 40;
  if (!cooling) score += 20;

  const err = Number(stats.errorCount || 0);
  score -= Math.min(err, 50);

  const lastUsed = Number(stats.lastUsed || 0);
  if (lastUsed > 0) score += Math.min((now - lastUsed) / (1000 * 60 * 60), 8); // stale relief

  return {
    id,
    score,
    reason: `${healthyIdx >= 0 ? `healthy#${healthyIdx + 1} ` : ''}${expired ? 'expired ' : ''}${disabled ? 'disabled ' : ''}${cooling ? 'cooldown ' : ''}err=${err}`.trim(),
  };
}

function main() {
  if (!fs.existsSync(AUTH_PATH)) {
    console.error(`Auth file not found: ${AUTH_PATH}`);
    process.exit(1);
  }

  const auth = loadAuth();
  const now = Date.now();
  const known = Object.keys(auth.profiles || {}).filter((k) => k.startsWith(`${PROVIDER}:`));
  const base = chooseProfileCandidates(known);

  const scored = base.map((id) => scoreProfile(id, auth, now));
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
  console.log('Scores:');
  for (const s of scored) {
    console.log(`- ${s.id}: ${s.score.toFixed(1)} (${s.reason || 'ok'})`);
  }
}

main();
