#!/usr/bin/env bash
# Bất biến SECURITY.md §6: không secret nào được nằm trong repo.
# CI chạy script này trước mọi bước khác; chạy tay bằng: pnpm check-secrets
set -euo pipefail

cd "$(dirname "$0")/.."

# Các pattern nhận diện secret thật (chuỗi đủ dài, không bắt nhầm tài liệu
# chỉ nhắc tới tiền tố như "sk-ant-").
PATTERNS='sk-ant-[A-Za-z0-9_-]{8,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

MATCHES=$(grep -rInE "$PATTERNS" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist \
  --exclude-dir=.turbo \
  --exclude=check-secrets.sh \
  . || true)

if [ -n "$MATCHES" ]; then
  echo "$MATCHES"
  echo ""
  echo "❌ Phát hiện chuỗi giống secret trong repo. Xóa ngay khỏi source."
  echo "   Nếu key thật đã bị commit: thu hồi và đổi key ngay lập tức."
  echo "   Nơi duy nhất được chứa secret: wrangler secret / .dev.vars (gitignored)."
  exit 1
fi

echo "✅ check-secrets: không phát hiện secret trong repo."
