-- Phase 3: スケジュール配信のためのフィールド追加
-- 既存 status CHECK 制約を差し替え、'sending' を追加
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('draft', 'sent', 'scheduled', 'sending'));

-- 予約日時
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 予約時点の宛先スナップショット（電話番号/contact_id/置換済みメッセージ）
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS recipients_snapshot JSONB;

-- 実行時の最終エラーメッセージ
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 予約中のキャンペーンを時刻順で拾うためのインデックス
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at
  ON campaigns(scheduled_at)
  WHERE status = 'scheduled';
