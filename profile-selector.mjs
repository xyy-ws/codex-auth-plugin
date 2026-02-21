const PROVIDER_ID = 'openai-codex';

export function chooseProfileCandidates(configProfileIds = []) {
  const seed = [`${PROVIDER_ID}:default`, `${PROVIDER_ID}:team2`];
  for (const id of configProfileIds) {
    if (typeof id === 'string' && id.startsWith(`${PROVIDER_ID}:`) && !seed.includes(id)) {
      seed.push(id);
    }
  }
  return seed;
}
