#!/usr/bin/env bash
# ==============================================================================
# Supply-chain guard.
#
# Detects the injection techniques used against this project in Aug 2026: an
# obfuscated Node loader appended to the end of a config file, and the same
# loader hidden in a file with a binary extension (a fake .woff2 font) so diffs
# render it as an unreadable blob.
#
# Usage:
#   ./scripts/security-scan.sh            # scan the working tree
# Exits non-zero when anything suspicious is found, so it can gate CI.
# ==============================================================================
set -uo pipefail

cd "$(dirname "$0")/.."

findings=0

report() {
  printf '\n[FAIL] %s\n' "$1"
  findings=$((findings + 1))
}

EXCLUDES=(
  --hidden
  --glob '!**/.git/**'
  --glob '!**/node_modules/**'
  --glob '!**/dist/**'
  --glob '!**/build/**'
  --glob '!**/coverage/**'
  --glob '!pnpm-lock.yaml'
  --glob '!package-lock.json'
  --glob '!yarn.lock'
  # The scanner and the host audit describe these signatures in their own
  # source, so they must be excluded or every run self-reports.
  --glob '!scripts/security-scan.sh'
  --glob '!scripts/vps-security-audit.sh'
  --glob '!.github/workflows/security-scan.yml'
)

echo "==> 1/5 remote-loader signatures"
if hits=$(rg -l "${EXCLUDES[@]}" \
  -e 'global\.i\s*=' \
  -e 'global\.r\s*=\s*require' \
  -e 'eth_getBlockByNumber' \
  -e 'ETH_RPC_URL' \
  -e 'blockscout' \
  -e 'drpc\.org' \
  . 2>/dev/null); then
  report "remote-loader signature found in:"$'\n'"$hits"
fi

echo "==> 2/5 javascript obfuscator output"
if hits=$(rg -l "${EXCLUDES[@]}" -e '_0x[0-9a-f]{4,6}\(0x' . 2>/dev/null); then
  report "obfuscated code found in:"$'\n'"$hits"
fi

echo "==> 3/5 executable text hidden in binary-extension files"
while IFS= read -r file; do
  [ -f "$file" ] || continue
  case "$file" in
    *.woff|*.woff2|*.ttf|*.eot|*.otf|*.png|*.jpg|*.jpeg|*.gif|*.ico|*.pdf|*.zip) ;;
    *) continue ;;
  esac
  if head -c 4096 "$file" | rg -q -e 'require\(' -e 'global\.' -e 'eval\(' -e 'child_process' 2>/dev/null; then
    report "binary-extension file contains executable text: $file"
  fi
done < <(git ls-files 2>/dev/null)

echo "==> 4/5 npm lifecycle hooks"
if hits=$(rg -n "${EXCLUDES[@]}" '"(preinstall|postinstall|prepare|prepublish|prepack)"\s*:' . 2>/dev/null); then
  report "install-time lifecycle hook present (verify it is intentional):"$'\n'"$hits"
fi

echo "==> 5/5 single-line payloads appended to source files"
if hits=$(rg -l "${EXCLUDES[@]}" \
  --glob '*.js' --glob '*.mjs' --glob '*.cjs' --glob '*.ts' --glob '*.tsx' --glob '*.json' \
  '.{1000,}' . 2>/dev/null); then
  report "abnormally long line in a source file:"$'\n'"$hits"
fi

echo
if [ "$findings" -gt 0 ]; then
  echo "Security scan FAILED with $findings finding(s)."
  echo "Do not merge, deploy, or run install scripts until each one is explained."
  exit 1
fi

echo "Security scan passed: no known injection markers found."
