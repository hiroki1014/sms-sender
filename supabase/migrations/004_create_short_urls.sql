-- 短縮URLテーブル
CREATE TABLE IF NOT EXISTS short_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  sms_log_id UUID REFERENCES sms_logs(id),
  contact_id UUID REFERENCES contacts(id),
  campaign_id UUID REFERENCES campaigns(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クリックログテーブル
CREATE TABLE IF NOT EXISTS click_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_url_id UUID REFERENCES short_urls(id),
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(code);
CREATE INDEX IF NOT EXISTS idx_short_urls_campaign_id ON short_urls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_short_urls_contact_id ON short_urls(contact_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_short_url_id ON click_logs(short_url_id);
CREATE INDEX IF NOT EXISTS idx_click_logs_clicked_at ON click_logs(clicked_at DESC);

-- RLS
ALTER TABLE short_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON short_urls
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON click_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
