#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { classifyFailure, chooseProfile, markCooldown, shouldCooldown } from './failover.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key.startsWith('--')) {
      args[key.slice(2)] = val;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const profiles = String(args.profiles || '').split(',').map((s) => s.trim()).filter(Boolean);
if (profiles.length < 2) {
  console.error('Usage: cli --profiles teamA,teamB --state /tmp/codex-failover.json [--error "msg"] [--cooldown-min 60]');
  process.exit(2);
}

const statePath = args.state || '/tmp/codex-failover.json';
const cooldownMin = Number(args['cooldown-min'] || 60);
const now = Date.now();

let state = {};
if (fs.existsSync(statePath)) {
  state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

if (args.error) {
  const kind = classifyFailure(args.error);
  const chosenBefore = chooseProfile({ orderedProfiles: profiles, state, now }).profile;
  if (shouldCooldown(kind)) {
    state = markCooldown({ state, profile: chosenBefore, cooldownMs: cooldownMin * 60 * 1000, now });
  }
}

const selected = chooseProfile({ orderedProfiles: profiles, state, now: Date.now() });
fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

process.stdout.write(JSON.stringify({
  selectedProfile: selected.profile,
  reason: selected.reason,
  statePath,
}, null, 2));
