import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pzabnsuemnqqgultgdmr.supabase.co',
  process.env.SUPABASE_SECRET_KEY
)

const sql = `
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

-- ポリシー（既に存在する場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON sms_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`

const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

if (error) {
  // rpcが使えない場合は直接クエリを試す
  const { error: error2 } = await supabase.from('sms_logs').select('id').limit(1)
  if (error2 && error2.code === '42P01') {
    console.log('Table does not exist. Trying REST API...')
    
    // REST APIでSQLを実行
    const response = await fetch('https://pzabnsuemnqqgultgdmr.supabase.co/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      },
      body: JSON.stringify({ sql_query: sql })
    })
    console.log('Response:', response.status)
  } else if (error2) {
    console.error('Error:', error2)
  } else {
    console.log('Table already exists!')
  }
} else {
  console.log('Table created successfully!')
}
