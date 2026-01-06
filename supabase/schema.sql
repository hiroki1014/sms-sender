-- SMS送信ログテーブル
-- Supabaseダッシュボードの SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（検索高速化）
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);

-- Row Level Security を有効化（オプション）
-- ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
