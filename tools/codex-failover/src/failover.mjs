const QUOTA_PATTERNS = [
  /insufficient[_ ]?quota/i,
  /billing/i,
  /额度已用完/i,
  /余额不足/i,
  /quota/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate[_ ]?limit/i,
  /cooldown/i,
  /处于冷却状态/i,
];

const WORKSPACE_PATTERNS = [
  /deactivated_workspace/i,
  /workspace[_ ]?deactivated/i,
  /工作区.*停用/i,
];

export function classifyFailure(input = '') {
  const text = String(input);
  if (QUOTA_PATTERNS.some((p) => p.test(text))) return 'quota';
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(text))) return 'rate_limit';
  if (WORKSPACE_PATTERNS.some((p) => p.test(text))) return 'workspace_deactivated';
  return 'other';
}

export function shouldCooldown(kind) {
  return kind === 'quota' || kind === 'rate_limit' || kind === 'workspace_deactivated';
}

export function chooseProfile({ orderedProfiles, state, now = Date.now() }) {
  if (!Array.isArray(orderedProfiles) || orderedProfiles.length === 0) {
    throw new Error('orderedProfiles is required');
  }

  const cooldowns = state?.cooldowns ?? {};
  const primary = orderedProfiles[0];
  const primaryUntil = Number(cooldowns[primary] ?? 0);

  if (primaryUntil > now) {
    const backup = orderedProfiles.find((p) => Number(cooldowns[p] ?? 0) <= now);
    return {
      profile: backup ?? primary,
      reason: backup ? 'primary_cooling_down' : 'all_profiles_cooling_down',
    };
  }

  return { profile: primary, reason: 'primary_ready' };
}

export function markCooldown({ state, profile, cooldownMs, now = Date.now() }) {
  const next = state ?? {};
  next.cooldowns = next.cooldowns ?? {};
  next.cooldowns[profile] = now + cooldownMs;
  return next;
}
