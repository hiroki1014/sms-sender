-- 到達率計測のためのフィールド追加
-- Twilio Status Callback で受け取る delivery_status を保存する

ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ;

-- webhook 受信時の SID 検索用
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_twilio_sid
  ON sms_logs(twilio_sid)
  WHERE twilio_sid IS NOT NULL;

-- キャンペーン単位の到達率集計を高速化
CREATE INDEX IF NOT EXISTS idx_sms_logs_delivery_status
  ON sms_logs(campaign_id, delivery_status);
