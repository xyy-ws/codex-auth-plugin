#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_DIST="/root/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/dist"
STAMP="$(date +%Y%m%d-%H%M%S)"

mapfile -t FILES < <(grep -RIl "function classifyFailoverReason(raw)" "$OPENCLAW_DIST"/pi-embedded-helpers-*.js)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "No target helper bundles found"
  exit 1
fi

patched=0
for f in "${FILES[@]}"; do
  if grep -q "deactivated_workspace" "$f"; then
    echo "already patched: $f"
    continue
  fi

  cp "$f" "$f.bak-$STAMP"
  python3 - "$f" <<'PY'
import sys
p=sys.argv[1]
s=open(p,'r',encoding='utf-8').read()
needle='"insufficient balance"'
if needle not in s:
    raise SystemExit(f'needle not found: {p}')
s=s.replace(needle,'"insufficient balance",\n\t\t"deactivated_workspace",\n\t\t"workspace deactivated"',1)
open(p,'w',encoding='utf-8').write(s)
print('patched',p)
PY
  patched=$((patched+1))
done

echo "patched_count=$patched"
openclaw gateway restart >/dev/null 2>&1 || true
openclaw gateway status | sed -n '1,20p'
