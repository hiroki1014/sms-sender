-- SMS送信ログテーブル
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);

-- Row Level Security
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Service role full access" ON sms_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
