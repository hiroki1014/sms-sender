# 分析ダッシュボード拡張 設計書

## 目的

SMS配信の効果を多角的に可視化し、「いつ送るべきか」「どのメッセージが効くか」「誰が反応しているか」「投資対効果はどうか」を判断できるようにする。

## 前提

- チャートライブラリ未導入 → **recharts** を新規追加
- データソース: sms_logs, click_logs, contacts, campaigns, short_urls（全て既存テーブル）
- ユーザーは非技術者のビジネスオーナー。直感的に読めるチャートが必須

---

## チャート一覧

### /analytics 一覧に追加（全体俯瞰）

#### 1. CPC カード
- 表示: `1クリックあたり ¥XX`
- 計算: `SUM(sms_logs.price) / COUNT(click_logs)`（price が null の場合はフォールバック ¥13 × segments で推定）
- 既存サマリーカード群の末尾に追加

#### 2. クリック時刻ヒートマップ（曜日 × 時間帯）
- X軸: 0〜23時（JST）
- Y軸: 月〜日
- セルの色: そのスロットのクリック数（濃い = 多い）
- 全キャンペーン横断で click_logs.clicked_at を集計
- 目的: 「火曜の夜20時がホットタイム」のような最適送信タイミングの発見

#### 3. 到達率・クリック率の推移（折れ線）
- X軸: キャンペーン（sent_at の時系列順）
- Y軸: パーセンテージ（0-100%）
- 2本の折れ線: 到達率（緑）, クリック率（青）
- 目的: トレンド把握。「到達率が下がってきた → リストクリーニング必要」等

#### 4. リピーターカード
- 表示: 「N人が複数キャンペーンでクリック / M人が一度も反応なし」
- 計算: contacts ごとにクリックしたキャンペーン数を集計
- 既存カード群に追加

### /analytics/[id] 詳細に追加（キャンペーン固有）

#### 5. 送信→クリックまでの時間分布（ヒストグラム）
- X軸: 経過時間バケット（0-5分, 5-15分, 15-30分, 30分-1時間, 1-3時間, 3-6時間, 6-12時間, 12-24時間, 24時間+）
- Y軸: クリック数
- 計算: `click_logs.clicked_at - sms_logs.sent_at`（short_urls.sms_log_id 経由で結合）
- 目的: 「ほとんどの人は15分以内にクリックする」→ 追客タイミング判断

#### 6. タグ別反応率（横棒グラフ）
- Y軸: タグ名（base, yahoo, rakuten 等）
- X軸: クリック率（%）
- contacts.tags と sms_logs/click_logs を結合して集計
- tags がある受信者がいる場合のみ表示
- 目的: 「base 経験者は反応率 2 倍」→ ターゲティング精度向上

---

## 技術設計

### チャートライブラリ

**recharts** (`npm install recharts`)
- React コンポーネントベース、Next.js App Router 対応
- BarChart, LineChart, Cell（ヒートマップ用）, PieChart 等
- 軽量 (~200KB gzipped)
- `'use client'` コンポーネント内で使用

### API 拡張

既存 `/api/analytics` のレスポンスに `charts` フィールドを追加。

#### 一覧用レスポンス拡張

```typescript
{
  overall: OverallStats,
  campaigns: CampaignStats[],
  charts: {
    // ヒートマップ: {day: 0-6, hour: 0-23, count: number}[]
    clickHeatmap: Array<{ day: number; hour: number; count: number }>,
    // 推移: キャンペーンごとの到達率・クリック率
    trend: Array<{ name: string; delivery_rate: number; click_rate: number }>,
    // CPC
    cpc: { total_cost: number; total_clicks: number; cpc: number },
    // リピーター
    repeaters: { multi_click_contacts: number; zero_click_contacts: number; total_contacts: number },
  }
}
```

#### 詳細用レスポンス拡張

```typescript
{
  campaign: CampaignStats,
  recipients: RecipientDetail[],
  charts: {
    // 時間分布: {bucket: string, count: number}[]
    timeToClick: Array<{ bucket: string; count: number }>,
    // タグ別: {tag: string, sent: number, clicked: number, rate: number}[]
    tagBreakdown: Array<{ tag: string; sent: number; clicked: number; rate: number }>,
  }
}
```

### 新規ファイル

| ファイル | 内容 |
|---|---|
| `components/charts/ClickHeatmap.tsx` | 曜日×時間帯ヒートマップ |
| `components/charts/TrendChart.tsx` | 到達率・クリック率推移の折れ線 |
| `components/charts/TimeToClickChart.tsx` | 送信→クリック時間分布のヒストグラム |
| `components/charts/TagBreakdownChart.tsx` | タグ別反応率の横棒 |

### 修正ファイル

| ファイル | 変更内容 |
|---|---|
| `app/api/analytics/route.ts` | charts データの集計ロジック追加 |
| `app/analytics/AnalyticsClient.tsx` | CPC カード + リピーターカード + 3チャート追加 |
| `app/analytics/[id]/CampaignDetailClient.tsx` | 2チャート追加 |
| `package.json` | recharts 依存追加 |

---

## タイムゾーン

ヒートマップの時間帯は JST で表示。`clicked_at`（UTC）から +9時間 してバケットに振り分ける。サーバー側で変換してからレスポンスに含める。

## パフォーマンス

- ヒートマップは全 click_logs を走査するため、件数が多い場合は直近 N 件に制限（初期: 10,000件）
- API レスポンスのキャッシュは今回見送り（MVP 規模では不要）

## 検証方法

1. `npm install recharts` → `npx tsc --noEmit` でビルド通過
2. `/analytics` でヒートマップ・推移・CPC が表示
3. `/analytics/[id]` で時間分布・タグ別が表示
4. データ 0 件の場合に空状態メッセージが出る
5. スマホ幅でもチャートが崩れない（recharts の ResponsiveContainer 使用）
