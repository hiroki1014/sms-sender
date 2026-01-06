#!/bin/bash

# SMS Sender セットアップスクリプト

set -e

echo "=== SMS Sender セットアップ ==="
echo ""

# 1. 依存関係インストール
echo "[1/4] 依存関係をインストール中..."
npm install

# 2. 環境変数ファイル作成
if [ ! -f .env.local ]; then
  echo "[2/4] 環境変数ファイルを作成中..."

  read -p "ログインパスワードを入力: " AUTH_PASSWORD
  read -p "Twilio Account SID (後で設定する場合は空Enter): " TWILIO_SID
  read -p "Twilio Auth Token (後で設定する場合は空Enter): " TWILIO_TOKEN
  read -p "Twilio 電話番号 (例: +81XXXXXXXXXX): " TWILIO_PHONE
  read -p "Supabase URL (後で設定する場合は空Enter): " SUPABASE_URL
  read -p "Supabase Anon Key (後で設定する場合は空Enter): " SUPABASE_KEY

  cat > .env.local << EOF
AUTH_PASSWORD=${AUTH_PASSWORD:-password}
TWILIO_ACCOUNT_SID=${TWILIO_SID:-AC_YOUR_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_TOKEN:-YOUR_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=${TWILIO_PHONE:-+81XXXXXXXXXX}
SUPABASE_URL=${SUPABASE_URL:-https://YOUR_PROJECT.supabase.co}
SUPABASE_ANON_KEY=${SUPABASE_KEY:-YOUR_ANON_KEY}
EOF

  echo ".env.local を作成しました"
else
  echo "[2/4] .env.local は既に存在します（スキップ）"
fi

# 3. Supabaseテーブル作成の案内
echo ""
echo "[3/4] Supabaseテーブルの作成"
echo "以下のSQLをSupabaseダッシュボードで実行してください:"
echo "https://supabase.com/dashboard → SQL Editor"
echo ""
echo "--- SQL ---"
cat supabase/schema.sql
echo "--- END ---"
echo ""

# 4. 開発サーバー起動
read -p "[4/4] 開発サーバーを起動しますか? (y/n): " START_DEV
if [ "$START_DEV" = "y" ]; then
  echo "http://localhost:3000 でアクセスできます"
  npm run dev
else
  echo ""
  echo "=== セットアップ完了 ==="
  echo "開発サーバー起動: npm run dev"
  echo "本番ビルド: npm run build"
fi
