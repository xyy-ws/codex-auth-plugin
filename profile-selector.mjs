const PROVIDER_ID = 'openai-codex';

export function chooseProfileCandidates(configProfileIds = []) {
  const preferred = [
    `${PROVIDER_ID}:team1`,
    `${PROVIDER_ID}:team2`,
    `${PROVIDER_ID}:team3`,
    `${PROVIDER_ID}:default`,
    `${PROVIDER_ID}:team4`,
    `${PROVIDER_ID}:team5`,
  ];

  const seen = new Set();
  const out = [];

  for (const id of preferred) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }

  for (const id of configProfileIds) {
    if (typeof id === 'string' && id.startsWith(`${PROVIDER_ID}:`) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }

  return out;
}
