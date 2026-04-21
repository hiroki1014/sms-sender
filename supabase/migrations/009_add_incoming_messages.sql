-- 受信メッセージテーブル
CREATE TABLE IF NOT EXISTS incoming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_sid TEXT UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  is_opt_out BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_incoming_contact ON incoming_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_incoming_received ON incoming_messages(received_at DESC);

ALTER TABLE incoming_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON incoming_messages
  FOR ALL USING (true) WITH CHECK (true);
