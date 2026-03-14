#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';
import { chooseProfileCandidates } from '../profile-selector.mjs';

const AUTH_PATH = path.join(os.homedir(), '.openclaw/agents/main/agent/auth-profiles.json');
const OPENCLAW_BIN = path.join(os.homedir(), '.nvm/versions/node/v22.22.0/bin/openclaw');
const PROVIDER = 'openai-codex';

function loadAuth() {
  return JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
}

function saveAuth(data) {
  fs.writeFileSync(AUTH_PATH, JSON.stringify(data, null, 2) + '\n');
}

function snapshotProfiles(data) {
  return JSON.parse(JSON.stringify(data.profiles || {}));
}

function changedProfiles(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) {
    const b = JSON.stringify(before[k] || null);
    const a = JSON.stringify(after[k] || null);
    if (b !== a) out.push(k);
  }
  return out;
}

async function chooseTarget(candidates) {
  const rl = readline.createInterface({ input, output });
  try {
    output.write('Choose target auth profile:\n');
    candidates.forEach((id, i) => output.write(`${i + 1}. ${id}\n`));
    const raw = (await rl.question(`Enter number or full id [${candidates[0]}]: `)).trim();
    if (!raw) return candidates[0];
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= candidates.length) return candidates[n - 1];
    if (candidates.includes(raw)) return raw;
    throw new Error(`Invalid selection: ${raw}`);
  } finally {
    rl.close();
  }
}

function runLogin() {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, ['models', 'auth', 'login', '--provider', PROVIDER], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`openclaw login exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function applyTargetProfile(target, authBefore, authAfter, changed) {
  const candidates = changed.filter((k) => k.startsWith(`${PROVIDER}:`));
  if (candidates.length === 0) {
    throw new Error('No openai-codex profile changes detected after login.');
  }

  let source = null;
  if (candidates.includes(target)) {
    source = target;
  } else {
    source = candidates[0];
  }

  const sourceRecord = authAfter.profiles?.[source];
  if (!sourceRecord) throw new Error(`Changed source profile not found: ${source}`);

  authAfter.profiles[target] = sourceRecord;
  if (source !== target) {
    authAfter.profiles[source] = authBefore.profiles?.[source] ?? authAfter.profiles[source];
  }

  authAfter.order ||= {};
  const existing = authAfter.order[PROVIDER] || [];
  authAfter.order[PROVIDER] = [
    target,
    ...existing.filter((x) => x !== target),
  ];

  authAfter.lastGood ||= {};
  authAfter.lastGood[PROVIDER] = target;

  authAfter.usageStats ||= {};
  authAfter.usageStats[target] ||= {};

  return { source, target };
}

async function main() {
  if (!fs.existsSync(AUTH_PATH)) throw new Error(`Auth file not found: ${AUTH_PATH}`);
  const authBefore = loadAuth();
  const candidates = chooseProfileCandidates(Object.keys(authBefore.profiles || {}));
  const target = await chooseTarget(candidates);

  const backupPath = `${AUTH_PATH}.bak.${Date.now()}`;
  fs.copyFileSync(AUTH_PATH, backupPath);
  output.write(`Backup written: ${backupPath}\n`);

  const beforeProfiles = snapshotProfiles(authBefore);
  await runLogin();

  const authAfter = loadAuth();
  const afterProfiles = snapshotProfiles(authAfter);
  const changed = changedProfiles(beforeProfiles, afterProfiles);
  const { source } = applyTargetProfile(target, authBefore, authAfter, changed);
  saveAuth(authAfter);

  output.write(`\nOAuth credentials applied to target profile: ${target}\n`);
  output.write(`Detected changed source profile: ${source}\n`);
  output.write(`Updated order/lastGood to prefer: ${target}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
