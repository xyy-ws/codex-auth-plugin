# codex-failover (MVP)

A lightweight failover helper for OpenClaw Codex profiles.

## Strategy (as requested)
- Mode: **A** — switch only on failure
- Trigger errors: **billing/quota + rate_limit/cooldown**
- Cooldown: **60 minutes**
- No auto switch-back probing (primary returns when cooldown expires)

## Files
- `src/failover.mjs` — core decision logic
- `src/cli.mjs` — CLI wrapper for stateful usage
- `test/failover.test.mjs` — node:test coverage

## Run tests
```bash
node --test tools/codex-failover/test/failover.test.mjs
```

## Example usage
```bash
node tools/codex-failover/src/cli.mjs \
  --profiles openai-codex:default,openai-codex:team2 \
  --state /tmp/codex-failover.json
```

On failure (quota/rate_limit), report error text to mark cooldown and select backup:
```bash
node tools/codex-failover/src/cli.mjs \
  --profiles openai-codex:default,openai-codex:team2 \
  --state /tmp/codex-failover.json \
  --cooldown-min 60 \
  --error "provider cooldown (rate_limit)"
```

Output:
```json
{
  "selectedProfile": "openai-codex:team2",
  "reason": "primary_cooling_down",
  "statePath": "/tmp/codex-failover.json"
}
```

## Notes
This is an external helper and does not patch OpenClaw core routing directly.
Use it in your wrapper/automation pipeline to decide which profile to prioritize.
