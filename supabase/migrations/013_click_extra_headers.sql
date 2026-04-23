ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS sec_fetch_site TEXT;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS sec_fetch_mode TEXT;
ALTER TABLE click_logs ADD COLUMN IF NOT EXISTS sec_fetch_dest TEXT;
