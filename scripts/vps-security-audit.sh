#!/usr/bin/env bash
# ==============================================================================
# Read-only post-incident audit for the deployment host.
#
# Checks whether the Aug 2026 loader ever executed on this machine and whether
# it left persistence behind. Makes no changes — every finding is printed for a
# human to act on.
#
# Usage (on the VPS):
#   ./scripts/vps-security-audit.sh
# ==============================================================================
set -uo pipefail

echo "=============================================="
echo " Deployment host security audit"
echo " $(date -u '+%Y-%m-%dT%H:%M:%SZ')  host: $(hostname)"
echo "=============================================="

section() { printf '\n--- %s ---\n' "$1"; }

section "1. Payload present in the deployed source tree"
# The audit and scan scripts contain these signatures themselves, so they are
# excluded — otherwise every run reports a false positive on its own source.
if command -v rg >/dev/null 2>&1; then
  rg -l --hidden --glob '!**/.git/**' --glob '!**/node_modules/**' \
    --glob '!scripts/vps-security-audit.sh' --glob '!scripts/security-scan.sh' \
    -e 'global\.i\s*=' -e 'global\.r\s*=\s*require' -e 'eth_getBlockByNumber' \
    . 2>/dev/null || echo "clean"
else
  grep -rlE 'global\.i[[:space:]]*=|eth_getBlockByNumber' \
    --exclude-dir=.git --exclude-dir=node_modules \
    --exclude=vps-security-audit.sh --exclude=security-scan.sh . 2>/dev/null || echo "clean"
fi

section "2. Fake font / binary-extension files carrying code"
find . -path ./node_modules -prune -o \
  \( -name '*.woff2' -o -name '*.woff' -o -name '*.ttf' -o -name '*.eot' \) -print 2>/dev/null |
  while IFS= read -r f; do
    if head -c 512 "$f" | grep -qE 'require\(|global\.|child_process' 2>/dev/null; then
      echo "SUSPECT: $f"
    fi
  done
echo "(no SUSPECT lines above = clean)"

section "3. Inline-eval node processes (the loader's execution method)"
# The payload runs itself via `spawn('node', ['-e', <code>])`, so inline eval is
# the signal worth alerting on. A plain list of node processes is pure noise.
ps -eo pid,ppid,etime,cmd 2>/dev/null |
  grep -E 'node[^ ]*[[:space:]]+(-e|--eval)[[:space:]]' |
  grep -v grep || echo "none"

section "4. Persistence: cron, systemd timers, shell profiles"
echo "* user crontab:"; crontab -l 2>/dev/null || echo "  (empty)"
echo "* /etc/cron.d:"; ls -1 /etc/cron.d 2>/dev/null || echo "  (empty)"
echo "* systemd user timers:"; systemctl --user list-timers --no-pager 2>/dev/null | head -10 || echo "  (none)"
echo "* profile files referencing node -e:"
grep -lE 'node[[:space:]]+-e' "$HOME"/.bashrc "$HOME"/.bash_profile "$HOME"/.profile 2>/dev/null || echo "  (none)"

section "5. Publicly exposed container ports"
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null
  echo
  echo "Anything bound to 0.0.0.0 other than the API port must be justified."
else
  echo "docker not available"
fi

section "6. SSH authorized_keys (unexpected entries = compromise)"
if [ -f "$HOME/.ssh/authorized_keys" ]; then
  awk '{print NR": "$1" "$3}' "$HOME/.ssh/authorized_keys"
else
  echo "no authorized_keys file"
fi

section "7. Recent successful SSH logins"
last -n 15 2>/dev/null || echo "unavailable"

section "8. Database: unexpected roles or tables"
if command -v docker >/dev/null 2>&1 && docker compose ps -q postgres >/dev/null 2>&1; then
  docker compose exec -T postgres psql -U postgres -d postgres \
    -c "SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname NOT LIKE 'pg\_%';" 2>/dev/null ||
    echo "could not query roles"
  docker compose exec -T postgres psql -U postgres -d "${POSTGRES_DB:-smart_meal_db}" \
    -c '\dt' 2>/dev/null || echo "could not list tables"
else
  echo "postgres container not running"
fi

echo
echo "=============================================="
echo " Audit complete. Review every SUSPECT / unexpected entry above."
echo "=============================================="
