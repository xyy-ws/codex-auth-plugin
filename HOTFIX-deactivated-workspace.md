# Hotfix: deactivated_workspace treated as billing-style failover

Date: 2026-02-26

## What was fixed
When provider responses include:

```json
{"detail":{"code":"deactivated_workspace"}}
```

the profile is now classified as **billing**-type failover reason (disabled/backoff), instead of being reused.

## Runtime patch location (current host)
Patched OpenClaw runtime bundles are now discovered dynamically by script.

### 2026.3.12 compatibility note
OpenClaw `2026.3.12` no longer uses the old fixed `pi-embedded-helpers-*.js` target pattern as the only patch surface.
The relevant `classifyFailoverReason(raw)` logic is distributed across multiple bundles under `dist/` (notably `dist/plugin-sdk/*`, plus several top-level bundles).

On this host, the updated script successfully patched **27 bundles** by scanning the whole `dist/` tree for `classifyFailoverReason(raw)` and injecting:
- `deactivated_workspace`
- `workspace deactivated`

Use this to verify current hits:

```bash
grep -RIn "deactivated_workspace\|workspace deactivated" \
  /root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist
```

## Validation
- The runtime patch script was updated to dynamic bundle discovery and executed successfully on OpenClaw `2026.3.12`.
- Verification confirmed `deactivated_workspace` markers are present in the patched runtime bundles.
- Note: this hotfix addresses Codex auth/failover classification only; it does **not** by itself resolve unrelated gateway WebSocket handshake timeout issues.
