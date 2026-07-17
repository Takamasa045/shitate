#!/bin/zsh

set -u

ROOT_DIR="${0:A:h}"
cd "$ROOT_DIR" || exit 1

clear
echo "----------------------------------------"
echo " Shitate Studio"
echo " キャラクターを育てる画面を開きます"
echo "----------------------------------------"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Node.js が見つかりません。"
  echo "https://nodejs.org/ja/download から Node.js 22 以上を入れてください。"
  echo ""
  read "?Enterキーで閉じます。"
  exit 1
fi

node scripts/launch-studio.mjs
STATUS=$?

if [[ $STATUS -ne 0 ]]; then
  echo ""
  read "?Enterキーで閉じます。"
fi

exit $STATUS
