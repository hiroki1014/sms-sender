ALTER TABLE incoming_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_incoming_from_number ON incoming_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone_number ON sms_logs(phone_number);
