-- キャンペーンテーブル
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- Row Level Security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Service role full access" ON campaigns
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- sms_logsにcampaign_id参照を追加
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign_id ON sms_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_id ON sms_logs(contact_id);
