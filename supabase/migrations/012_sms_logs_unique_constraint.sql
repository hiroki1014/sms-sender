-- 電話番号を国内形式に正規化（+81XXXXXXXXXX → 0XXXXXXXXXX）
UPDATE sms_logs SET phone_number = CONCAT('0', SUBSTRING(phone_number FROM 4)) WHERE phone_number LIKE '+81%';

-- pending ステータスを許可（ログ先書きパターン用）
ALTER TABLE sms_logs DROP CONSTRAINT IF EXISTS sms_logs_status_check;
ALTER TABLE sms_logs ADD CONSTRAINT sms_logs_status_check CHECK (status IN ('success', 'failed', 'pending'));

-- 重複データを削除してからユニーク制約を作成
DELETE FROM sms_logs
WHERE campaign_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (campaign_id, phone_number) id
    FROM sms_logs
    WHERE campaign_id IS NOT NULL
    ORDER BY campaign_id, phone_number, CASE WHEN status = 'success' THEN 0 ELSE 1 END, sent_at DESC
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_campaign_phone
ON sms_logs (campaign_id, phone_number)
WHERE campaign_id IS NOT NULL;
