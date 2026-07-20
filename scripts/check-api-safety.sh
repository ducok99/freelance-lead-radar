#!/usr/bin/env bash
# SECURITY.md §3: Workers không được chứa Facebook bot, kỹ thuật né phát hiện
# hoặc dependency browser/proxy phía server.
set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE_PATTERNS='facebook\.com|messenger\.com|proxy-rotate|proxy rotation|fingerprint spoof|humanize|stealth|captcha bypass|checkpoint bypass'
SOURCE_MATCHES=$(grep -rInEi "$SOURCE_PATTERNS" workers/api/src \
  --exclude='*.test.ts' \
  --exclude='test-fixtures.ts' || true)

if [ -n "$SOURCE_MATCHES" ]; then
  echo "$SOURCE_MATCHES"
  echo "❌ workers/api chứa dấu hiệu hành vi server-side bị cấm."
  exit 1
fi

DEPENDENCY_MATCHES=$(grep -nEi '"(puppeteer|playwright|selenium|axios|got|proxy-agent|https-proxy-agent)"' workers/api/package.json || true)
if [ -n "$DEPENDENCY_MATCHES" ]; then
  echo "$DEPENDENCY_MATCHES"
  echo "❌ workers/api có dependency HTTP/browser/proxy không được duyệt."
  exit 1
fi

echo "✅ check-api-safety: không phát hiện Facebook bot/proxy/stealth dependency."
