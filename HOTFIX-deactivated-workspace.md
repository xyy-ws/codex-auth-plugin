# Hotfix: deactivated_workspace treated as billing-style failover

Date: 2026-02-26

## What was fixed
When provider responses include:

```json
{"detail":{"code":"deactivated_workspace"}}
```

the profile is now classified as **billing**-type failover reason (disabled/backoff), instead of being reused.

## Runtime patch location (current host)
Patched OpenClaw runtime bundles:

- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-ClTYggYK.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-qpt11QnD.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/plugin-sdk/pi-embedded-helpers-CBo4-3UR.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-CwEnSdky.js`
- `/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist/pi-embedded-helpers-lwhKscBX.js`

## Validation
- Gateway restarted successfully.
- User-side test passed after restart.
