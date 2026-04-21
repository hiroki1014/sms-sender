# 分析ダッシュボード チャート機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SMS配信の効果をチャートで可視化し、送信タイミング最適化・メッセージ改善・ターゲティング精度向上を支援する。

**Architecture:** 既存 `/api/analytics` のレスポンスに `charts` フィールドを追加し、サーバー側で集計。recharts で描画する4つのチャートコンポーネントを `components/charts/` に新設し、一覧・詳細画面にそれぞれ配置。

**Tech Stack:** recharts, Next.js 14 App Router, TailwindCSS, Supabase (PostgreSQL)

---

## ファイル構成

### 新規作成
- `components/charts/ClickHeatmap.tsx` — 曜日×時間帯ヒートマップ
- `components/charts/TrendChart.tsx` — 到達率・クリック率推移の折れ線
- `components/charts/TimeToClickChart.tsx` — 送信→クリック時間分布のヒストグラム
- `components/charts/TagBreakdownChart.tsx` — タグ別反応率の横棒

### 修正
- `app/api/analytics/route.ts` — charts 集計ロジック追加
- `app/analytics/AnalyticsClient.tsx` — CPC/リピーターカード + チャート3つ配置
- `app/analytics/[id]/CampaignDetailClient.tsx` — チャート2つ配置
- `package.json` — recharts 依存追加

---

## Task 1: recharts 導入

**Files:**
- Modify: `package.json`

- [ ] **Step 1: recharts をインストール**

```bash
npm install recharts
```

- [ ] **Step 2: 型チェック通過を確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json
git commit -m "recharts を導入"
```

---

## Task 2: API — 一覧用チャートデータ集計

**Files:**
- Modify: `app/api/analytics/route.ts`

一覧 API (`getOverallStats`) のレスポンスに `charts` を追加。

- [ ] **Step 1: チャート用の型定義を追加**

`route.ts` の先頭の型定義セクション (L5-35 付近) に追加:

```typescript
interface OverallCharts {
  clickHeatmap: Array<{ day: number; hour: number; count: number }>
  trend: Array<{ name: string; delivery_rate: number; click_rate: number }>
  cpc: { total_cost: number; total_clicks: number; cpc: number }
  repeaters: { multi_click_contacts: number; zero_click_contacts: number; total_contacts: number }
}
```

`getOverallStats` の返り値型を拡張:

```typescript
async function getOverallStats(supabase: ...): Promise<{
  overall: OverallStats
  campaigns: CampaignStats[]
  charts: OverallCharts
}>
```

- [ ] **Step 2: ヒートマップ集計ロジックを追加**

`getOverallStats` 内、`return` の前に:

```typescript
// ヒートマップ: click_logs の clicked_at を曜日×時間帯で集計 (JST)
const { data: allClicks } = await supabase
  .from('click_logs')
  .select('clicked_at')
  .order('clicked_at', { ascending: false })
  .limit(10000)

const heatmapMap = new Map<string, number>()
allClicks?.forEach(c => {
  const dt = new Date(c.clicked_at)
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000)
  const day = jst.getUTCDay()
  const hour = jst.getUTCHours()
  const key = `${day}-${hour}`
  heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1)
})

const clickHeatmap: OverallCharts['clickHeatmap'] = []
for (let day = 0; day < 7; day++) {
  for (let hour = 0; hour < 24; hour++) {
    const count = heatmapMap.get(`${day}-${hour}`) || 0
    if (count > 0) clickHeatmap.push({ day, hour, count })
  }
}
```

- [ ] **Step 3: 推移・CPC・リピーター集計を追加**

```typescript
// 推移: campaignStats から抽出 (sent_at 昇順)
const trend = [...campaignStats]
  .sort((a, b) => (a.sent_at || '').localeCompare(b.sent_at || ''))
  .map(c => ({
    name: c.campaign_name,
    delivery_rate: c.delivery_rate,
    click_rate: c.click_rate,
  }))

// CPC
const totalCost = (smsLogs || []).reduce((sum, l: any) => sum + (Number(l.price) || 0), 0)
const cpc = {
  total_cost: Math.round(totalCost),
  total_clicks: totalClicks,
  cpc: totalClicks > 0 ? Math.round(totalCost / totalClicks) : 0,
}

// リピーター (contact_id 別にクリック回数集計)
const contactClickCampaigns = new Map<string, Set<string>>()
shortUrls?.forEach(su => {
  if (!su.contact_id || !su.campaign_id) return
  const clicked = clickLogs?.some(cl => cl.short_url_id === su.id)
  if (clicked) {
    if (!contactClickCampaigns.has(su.contact_id)) {
      contactClickCampaigns.set(su.contact_id, new Set())
    }
    contactClickCampaigns.get(su.contact_id)!.add(su.campaign_id)
  }
})
const { data: allContacts } = await supabase
  .from('contacts')
  .select('id', { count: 'exact' })
  .eq('opted_out', false)
const totalContacts = allContacts?.length || 0
const multiClickContacts = Array.from(contactClickCampaigns.values()).filter(s => s.size > 1).length
const zeroClickContacts = totalContacts - contactClickCampaigns.size

const repeaters = {
  multi_click_contacts: multiClickContacts,
  zero_click_contacts: Math.max(0, zeroClickContacts),
  total_contacts: totalContacts,
}
```

注意: sms_logs の select に `price` を追加する必要あり。既存の `.select('campaign_id, status, delivery_status')` を `.select('campaign_id, status, delivery_status, price')` に変更。

同様に shortUrls の select に `contact_id` を追加: `.select('id, campaign_id')` → `.select('id, campaign_id, contact_id')`

- [ ] **Step 4: return に charts を含める**

既存の `return { overall, campaigns: campaignStats }` を:

```typescript
return {
  overall: { ...overall部分 },
  campaigns: campaignStats,
  charts: { clickHeatmap, trend, cpc, repeaters },
}
```

空キャンペーン時の早期リターンにも空 charts を追加:

```typescript
charts: {
  clickHeatmap: [],
  trend: [],
  cpc: { total_cost: 0, total_clicks: 0, cpc: 0 },
  repeaters: { multi_click_contacts: 0, zero_click_contacts: 0, total_contacts: 0 },
}
```

- [ ] **Step 5: 型チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: コミット**

```bash
git add app/api/analytics/route.ts
git commit -m "一覧用チャートデータ(ヒートマップ/推移/CPC/リピーター)の集計ロジックを追加"
```

---

## Task 3: API — 詳細用チャートデータ集計

**Files:**
- Modify: `app/api/analytics/route.ts`

詳細 API (`getCampaignDetailStats`) に `charts` を追加。

- [ ] **Step 1: 詳細チャート型定義を追加**

```typescript
interface DetailCharts {
  timeToClick: Array<{ bucket: string; count: number }>
  tagBreakdown: Array<{ tag: string; sent: number; clicked: number; rate: number }>
}
```

返り値を拡張:

```typescript
Promise<{
  campaign: CampaignStats
  recipients: RecipientDetail[]
  charts: DetailCharts
}>
```

- [ ] **Step 2: 送信→クリック時間分布の集計**

`getCampaignDetailStats` 内、recipients 構築の後に:

```typescript
// 送信→クリック時間分布
const TIME_BUCKETS = [
  { label: '0-5分', maxMin: 5 },
  { label: '5-15分', maxMin: 15 },
  { label: '15-30分', maxMin: 30 },
  { label: '30分-1時間', maxMin: 60 },
  { label: '1-3時間', maxMin: 180 },
  { label: '3-6時間', maxMin: 360 },
  { label: '6-12時間', maxMin: 720 },
  { label: '12-24時間', maxMin: 1440 },
  { label: '24時間+', maxMin: Infinity },
]

const bucketCounts = new Map<string, number>()
TIME_BUCKETS.forEach(b => bucketCounts.set(b.label, 0))

// sms_logs.sent_at と click_logs.clicked_at の差分を計算
const smsLogMap = new Map<string, string>()
smsLogs?.forEach(l => { if (l.sent_at) smsLogMap.set(l.id, l.sent_at) })

const shortUrlToLog = new Map<string, string>()
shortUrls?.forEach(su => { if (su.sms_log_id) shortUrlToLog.set(su.id, su.sms_log_id) })

clickLogs?.forEach(click => {
  const logId = shortUrlToLog.get(click.short_url_id)
  if (!logId) return
  const sentAt = smsLogMap.get(logId)
  if (!sentAt) return
  const diffMin = (new Date(click.clicked_at).getTime() - new Date(sentAt).getTime()) / 60000
  if (diffMin < 0) return
  for (const bucket of TIME_BUCKETS) {
    if (diffMin < bucket.maxMin) {
      bucketCounts.set(bucket.label, (bucketCounts.get(bucket.label) || 0) + 1)
      break
    }
  }
})

const timeToClick = TIME_BUCKETS.map(b => ({
  bucket: b.label,
  count: bucketCounts.get(b.label) || 0,
}))
```

- [ ] **Step 3: タグ別反応率の集計**

```typescript
// タグ別反応率
const tagStats = new Map<string, { sent: number; clicked: number }>()

// sms_log_id → contact_id マッピング
const logToContact = new Map<string, string>()
smsLogs?.forEach(l => { if (l.contact_id) logToContact.set(l.id, l.contact_id) })

// contact_id → tags マッピング
const contactTags = new Map<string, string[]>()
const allContactIds = Array.from(new Set((smsLogs || []).map(l => l.contact_id).filter(Boolean)))
if (allContactIds.length > 0) {
  const { data: taggedContacts } = await supabase
    .from('contacts')
    .select('id, tags')
    .in('id', allContactIds)
  taggedContacts?.forEach(c => {
    if (c.tags && c.tags.length > 0) contactTags.set(c.id, c.tags)
  })
}

// 送信数: contact → tags → 各 tag にカウント
smsLogs?.forEach(l => {
  if (!l.contact_id) return
  const tags = contactTags.get(l.contact_id)
  if (!tags) return
  tags.forEach(tag => {
    if (!tagStats.has(tag)) tagStats.set(tag, { sent: 0, clicked: 0 })
    tagStats.get(tag)!.sent++
  })
})

// クリック数: click → short_url → sms_log → contact → tags
const clickedLogIds = new Set<string>()
clickLogs?.forEach(click => {
  const logId = shortUrlToLog.get(click.short_url_id)
  if (logId) clickedLogIds.add(logId)
})
clickedLogIds.forEach(logId => {
  const contactId = logToContact.get(logId)
  if (!contactId) return
  const tags = contactTags.get(contactId)
  if (!tags) return
  tags.forEach(tag => {
    if (tagStats.has(tag)) tagStats.get(tag)!.clicked++
  })
})

const tagBreakdown = Array.from(tagStats.entries())
  .map(([tag, s]) => ({
    tag,
    sent: s.sent,
    clicked: s.clicked,
    rate: s.sent > 0 ? Math.round((s.clicked / s.sent) * 100) : 0,
  }))
  .sort((a, b) => b.rate - a.rate)
```

- [ ] **Step 4: return に charts を含める**

```typescript
return {
  campaign: { ...既存 },
  recipients,
  charts: { timeToClick, tagBreakdown },
}
```

- [ ] **Step 5: 型チェック + コミット**

```bash
npx tsc --noEmit
git add app/api/analytics/route.ts
git commit -m "詳細用チャートデータ(時間分布/タグ別反応率)の集計ロジックを追加"
```

---

## Task 4: コンポーネント — ClickHeatmap

**Files:**
- Create: `components/charts/ClickHeatmap.tsx`

- [ ] **Step 1: ヒートマップコンポーネントを作成**

```tsx
'use client'

import { ResponsiveContainer, ScatterChart, XAxis, YAxis, ZAxis, Scatter, Tooltip, Cell } from 'recharts'

interface HeatmapProps {
  data: Array<{ day: number; hour: number; count: number }>
}

const DAYS = ['日', '月', '火', '水', '木', '金', '土']
const COLORS = ['#f0f0f0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']

function getColor(count: number, max: number): string {
  if (count === 0) return COLORS[0]
  const ratio = count / max
  if (ratio < 0.25) return COLORS[1]
  if (ratio < 0.5) return COLORS[2]
  if (ratio < 0.75) return COLORS[3]
  return COLORS[4]
}

export default function ClickHeatmap({ data }: HeatmapProps) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">クリックデータがありません</p>
  }

  const max = Math.max(...data.map(d => d.count))

  // 全スロット埋める (0件も含む)
  const fullData: Array<{ day: number; hour: number; count: number }> = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const found = data.find(d => d.day === day && d.hour === hour)
      fullData.push({ day, hour, count: found?.count || 0 })
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">クリック時間帯（JST）</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 30 }}>
          <XAxis
            type="number"
            dataKey="hour"
            domain={[0, 23]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
            tickFormatter={(v) => `${v}時`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="day"
            domain={[0, 6]}
            ticks={[0, 1, 2, 3, 4, 5, 6]}
            tickFormatter={(v) => DAYS[v] || ''}
            tick={{ fontSize: 11 }}
            reversed
          />
          <ZAxis type="number" dataKey="count" range={[80, 80]} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.[0]) return null
              const d = payload[0].payload
              return (
                <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow">
                  {DAYS[d.day]} {d.hour}時台: {d.count}クリック
                </div>
              )
            }}
          />
          <Scatter data={fullData} shape="square">
            {fullData.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.count, max)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/charts/ClickHeatmap.tsx
git commit -m "クリック時刻ヒートマップコンポーネントを追加"
```

---

## Task 5: コンポーネント — TrendChart

**Files:**
- Create: `components/charts/TrendChart.tsx`

- [ ] **Step 1: 推移折れ線コンポーネントを作成**

```tsx
'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'

interface TrendProps {
  data: Array<{ name: string; delivery_rate: number; click_rate: number }>
}

export default function TrendChart({ data }: TrendProps) {
  if (data.length < 2) {
    return <p className="text-sm text-gray-400 text-center py-8">推移を表示するには2件以上のキャンペーンが必要です</p>
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">到達率・クリック率の推移</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + '…' : v}
          />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value}%`,
              name === 'delivery_rate' ? '到達率' : 'クリック率',
            ]}
          />
          <Legend formatter={(v) => v === 'delivery_rate' ? '到達率' : 'クリック率'} />
          <Line type="monotone" dataKey="delivery_rate" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="click_rate" stroke="#6366F1" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/charts/TrendChart.tsx
git commit -m "到達率・クリック率推移チャートコンポーネントを追加"
```

---

## Task 6: コンポーネント — TimeToClickChart

**Files:**
- Create: `components/charts/TimeToClickChart.tsx`

- [ ] **Step 1: ヒストグラムコンポーネントを作成**

```tsx
'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface TimeToClickProps {
  data: Array<{ bucket: string; count: number }>
}

export default function TimeToClickChart({ data }: TimeToClickProps) {
  const hasData = data.some(d => d.count > 0)
  if (!hasData) {
    return <p className="text-sm text-gray-400 text-center py-8">クリックデータがありません</p>
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">送信からクリックまでの時間</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value}件`, 'クリック数']}
          />
          <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/charts/TimeToClickChart.tsx
git commit -m "送信→クリック時間分布チャートコンポーネントを追加"
```

---

## Task 7: コンポーネント — TagBreakdownChart

**Files:**
- Create: `components/charts/TagBreakdownChart.tsx`

- [ ] **Step 1: 横棒コンポーネントを作成**

```tsx
'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface TagBreakdownProps {
  data: Array<{ tag: string; sent: number; clicked: number; rate: number }>
}

export default function TagBreakdownChart({ data }: TagBreakdownProps) {
  if (data.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">タグ別クリック率</h3>
      <ResponsiveContainer width="100%" height={Math.max(150, data.length * 40 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} width={55} />
          <Tooltip
            formatter={(value: number, name: string) => [
              name === 'rate' ? `${value}%` : `${value}件`,
              name === 'rate' ? 'クリック率' : name === 'sent' ? '送信数' : 'クリック数',
            ]}
          />
          <Bar dataKey="rate" fill="#F59E0B" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/charts/TagBreakdownChart.tsx
git commit -m "タグ別反応率チャートコンポーネントを追加"
```

---

## Task 8: UI — AnalyticsClient にチャートを配置

**Files:**
- Modify: `app/analytics/AnalyticsClient.tsx`

- [ ] **Step 1: import と型定義を追加**

ファイル先頭に:

```tsx
import ClickHeatmap from '@/components/charts/ClickHeatmap'
import TrendChart from '@/components/charts/TrendChart'
```

`AnalyticsData` インターフェースに charts を追加:

```typescript
interface AnalyticsData {
  overall: OverallStats
  campaigns: CampaignStats[]
  charts: {
    clickHeatmap: Array<{ day: number; hour: number; count: number }>
    trend: Array<{ name: string; delivery_rate: number; click_rate: number }>
    cpc: { total_cost: number; total_clicks: number; cpc: number }
    repeaters: { multi_click_contacts: number; zero_click_contacts: number; total_contacts: number }
  }
}
```

- [ ] **Step 2: サマリーカード群に CPC とリピーターを追加**

既存の4カード (`grid-cols-2 md:grid-cols-4`) を `md:grid-cols-3` 2行(6枠) に変更し、CPCカードとリピーターカードを追加:

```tsx
{data.charts && (
  <>
    <StatCard
      icon={<CursorClick className="w-5 h-5" />}
      label="CPC"
      value={data.charts.cpc.cpc > 0 ? `¥${data.charts.cpc.cpc}` : '-'}
      subValue={data.charts.cpc.total_clicks > 0 ? `総額 ¥${data.charts.cpc.total_cost.toLocaleString()} / ${data.charts.cpc.total_clicks}クリック` : ''}
      color="text-accent-500"
    />
    <StatCard
      icon={<Check className="w-5 h-5" />}
      label="リピーター"
      value={`${data.charts.repeaters.multi_click_contacts}人`}
      subValue={`未反応 ${data.charts.repeaters.zero_click_contacts}人 / 全${data.charts.repeaters.total_contacts}人`}
      color="text-warning"
    />
  </>
)}
```

- [ ] **Step 3: チャートセクションを追加**

キャンペーンテーブルの上に:

```tsx
{data.charts && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <Card className="p-4">
      <ClickHeatmap data={data.charts.clickHeatmap} />
    </Card>
    <Card className="p-4">
      <TrendChart data={data.charts.trend} />
    </Card>
  </div>
)}
```

- [ ] **Step 4: 型チェック + コミット**

```bash
npx tsc --noEmit
git add app/analytics/AnalyticsClient.tsx
git commit -m "分析一覧にCPCカード/リピーター/ヒートマップ/推移チャートを追加"
```

---

## Task 9: UI — CampaignDetailClient にチャートを配置

**Files:**
- Modify: `app/analytics/[id]/CampaignDetailClient.tsx`

- [ ] **Step 1: import と型定義を追加**

```tsx
import TimeToClickChart from '@/components/charts/TimeToClickChart'
import TagBreakdownChart from '@/components/charts/TagBreakdownChart'
```

`DetailData` に charts を追加:

```typescript
interface DetailData {
  campaign: CampaignStats
  recipients: Recipient[]
  charts: {
    timeToClick: Array<{ bucket: string; count: number }>
    tagBreakdown: Array<{ tag: string; sent: number; clicked: number; rate: number }>
  }
}
```

- [ ] **Step 2: サマリーカードと受信者テーブルの間にチャートを配置**

```tsx
{data.charts && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <Card className="p-4">
      <TimeToClickChart data={data.charts.timeToClick} />
    </Card>
    {data.charts.tagBreakdown.length > 0 && (
      <Card className="p-4">
        <TagBreakdownChart data={data.charts.tagBreakdown} />
      </Card>
    )}
  </div>
)}
```

- [ ] **Step 3: 型チェック + コミット**

```bash
npx tsc --noEmit
git add app/analytics/[id]/CampaignDetailClient.tsx
git commit -m "キャンペーン詳細に時間分布/タグ別チャートを追加"
```

---

## Task 10: 全体検証

- [ ] **Step 1: 全テスト実行**

```bash
npm run test:run
```

- [ ] **Step 2: dev サーバーで動作確認**

```bash
npm run dev
```

確認項目:
1. `/analytics` — ヒートマップ・推移・CPC・リピーターが表示される
2. `/analytics/[id]` — 時間分布・タグ別が表示される
3. データ 0 件 → 空状態メッセージ
4. ブラウザ幅を狭めてもチャートが崩れない

- [ ] **Step 3: push**

```bash
git push
```
