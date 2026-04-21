-- 送信実績の料金データを保存（Twilio APIレスポンスから取得）
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS num_segments INTEGER;
