# Claude Code プロジェクト設定

## コミットメッセージ

- **日本語で書く**
- 簡潔に変更内容を説明する

## テスト

- `npm run test:run` で全テスト実行
- テストファイルは `tests/` 配下に配置

## Supabase

- **マイグレーションはCLIで実行する**
- `npx supabase db push` でマイグレーション適用
- マイグレーションファイルは `supabase/migrations/` 配下
