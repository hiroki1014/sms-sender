-- 顧客テーブル
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  tags TEXT[] DEFAULT '{}',
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(opted_out);

-- Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "Service role full access" ON contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- sms_logsにcontact_id参照を追加
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
