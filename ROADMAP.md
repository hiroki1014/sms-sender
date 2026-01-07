# SMS送信アプリ マーケティング拡張ロードマップ

## ビジネス概要
- **サービス**: ブランド品仕入れ・販売コンサル
- **ターゲット**: ECプラットフォーム経験者（Base, Yahoo, 楽天など）
- **大枠**: 副業・稼ぐことに興味がある人

## ゴール
```
SMS送信 → LP/相談予約ページ → コンサル成約
```

---

## Phase 1: 配信リスト管理 ✅ 完了

### 機能一覧
| 機能 | 説明 | 状況 |
|------|------|------|
| 顧客DB保存 | 顧客情報をSupabaseに永続化 | ✅ |
| タグ付け | base/yahoo/rakuten等でセグメント | ✅ |
| 配信停止管理 | オプトアウトした人を除外 | ✅ |
| 重複排除 | 同じ電話番号の重複登録を防止 | ✅ |
| 送信履歴紐付け | 顧客ごとの送信履歴を記録 | ✅ |
| CSVインポート | 既存リストを一括登録 | ✅ |
| キャンペーン管理 | 送信施策を名前付けて管理 | ✅ |

### DBスキーマ

```sql
-- 顧客テーブル
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  tags TEXT[] DEFAULT '{}',
  opted_out BOOLEAN DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- キャンペーンテーブル
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, scheduled
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 送信履歴テーブル（既存のsms_logsを拡張）
CREATE TABLE send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  campaign_id UUID REFERENCES campaigns(id),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL, -- success, failed
  error_message TEXT,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI追加
- `/contacts` - 顧客一覧・管理画面 ✅
- `/contacts/import` - CSVインポート画面 ✅
- `/campaigns` - キャンペーン一覧 ✅
- `/campaigns/new` - キャンペーン作成 ✅

### 実装ファイル
```
app/
├── contacts/
│   ├── page.tsx           # 顧客一覧
│   └── import/
│       └── page.tsx       # CSVインポート
├── campaigns/
│   ├── page.tsx           # キャンペーン一覧
│   └── new/
│       └── page.tsx       # 新規作成（現dashboard移行）
└── api/
    ├── contacts/
    │   └── route.ts       # CRUD API
    └── campaigns/
        └── route.ts       # CRUD API

lib/
└── db.ts                  # Supabase操作関数

components/
├── ContactsTable.tsx      # 顧客一覧テーブル
├── TagSelector.tsx        # タグ選択UI
└── CsvImporter.tsx        # CSVインポートUI
```

---

## Phase 2: 効果測定 ✅ 完了

### 機能一覧
| 機能 | 説明 | 状況 |
|------|------|------|
| 短縮URL生成 | クリック計測用の短縮URLを自動生成 | ✅ |
| クリック追跡 | 誰がいつクリックしたか記録 | ✅ |
| ダッシュボード | 送信数/到達率/クリック率を可視化 | ✅ |
| キャンペーン比較 | どのメッセージが効果的か比較 | ✅ |

### 短縮URL実装方法
```
1. メッセージ内のURLを検出
2. 短縮URL生成（例: yourapp.com/r/abc123）
3. リダイレクト時にクリックを記録
4. 元のURLへ転送
```

### DBスキーマ追加
```sql
-- 短縮URLテーブル
CREATE TABLE short_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- abc123
  original_url TEXT NOT NULL,
  send_log_id UUID REFERENCES send_logs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クリックログ
CREATE TABLE click_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_url_id UUID REFERENCES short_urls(id),
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);
```

### UI追加
- `/analytics` - ダッシュボード画面 ✅
- `/r/[code]` - リダイレクト用エンドポイント ✅

### 設定
- 環境変数 `SHORT_URL_BASE` でカスタムドメイン設定可能

---

## Phase 3: スケジュール配信（将来）

### 機能一覧
| 機能 | 説明 |
|------|------|
| 日時指定送信 | 指定日時に自動送信 |
| 定期配信 | 毎週月曜9時など繰り返し |
| 配信キュー | 大量送信時のレート制限対応 |

### 実装方法
- Vercel Cron Jobs または Supabase Edge Functions
- 配信予約テーブルを定期チェック

---

## 技術スタック（現状）
- **Frontend**: Next.js 14 (App Router)
- **Styling**: TailwindCSS + カスタムデザインシステム
- **Database**: Supabase (PostgreSQL)
- **SMS**: Twilio
- **Hosting**: Vercel
- **認証**: パスワード認証
- **テスト**: Vitest + Testing Library

## 完了済みの追加実装

### テスト基盤 ✅
- Vitest 設定
- APIルートテスト（send-sms, auth, contacts, logs）
- モック基盤（Supabase, Auth, Next.js headers）
- テストファクトリ関数

### UIリファクタリング ✅
- AppLayout / Sidebar コンポーネント
- 再利用可能UIコンポーネント（Button, Card, Table等）
- 統一されたデザインシステム

---

## 実装順序

### Step 1: DB拡張
1. Supabaseに新しいテーブル作成
2. lib/db.ts に操作関数追加

### Step 2: 顧客管理画面
1. /contacts ページ作成
2. CRUD API作成
3. CSVインポート機能

### Step 3: キャンペーン管理
1. /campaigns ページ作成
2. 既存のダッシュボードを /campaigns/new に移行
3. タグでフィルターして送信

### Step 4: 効果測定
1. 短縮URL生成機能
2. リダイレクトエンドポイント
3. ダッシュボード画面

---

## 注意事項

### 法令遵守
- 特定電子メール法に準拠
- 配信停止方法を必ず記載
- 同意なき送信は禁止

### ベストプラクティス
- SMSは70文字以内が理想（分割送信回避）
- 配信時間は平日10-18時が効果的
- 週1-2回が適切な頻度
- CTAは1つに絞る

---

## 現在のリポジトリ
- GitHub: https://github.com/hiroki1014/sms-sender
- ローカル: /home/hirokiwsl/Projects/sms-sender-ui
