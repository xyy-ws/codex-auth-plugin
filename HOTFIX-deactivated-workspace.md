# Hotfix: deactivated_workspace treated as billing-style failover

Date: 2026-02-26

## What was fixed
When provider responses include:

```json
{"detail":{"code":"deactivated_workspace"}}
```

the profile is now classified as **billing**-type failover reason (disabled/backoff), instead of being reused.

## Runtime patch location (current host)
Patched OpenClaw runtime bundles (discovered dynamically by script):

- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-CfNmwTZm.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-CfzQiGiz.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-DTexeCSz.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-uJGEQMgi.js`

(Names change across OpenClaw versions; use `tools/patch-deactivated-workspace-runtime.sh` to locate and patch current bundles.)

## Validation
- Gateway restarted successfully.
- User-side test passed after restart.
