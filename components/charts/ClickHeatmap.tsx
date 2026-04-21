'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type HeatmapData = {
  day: number;
  hour: number;
  count: number;
};

type Props = {
  data: Array<HeatmapData>;
};

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function getColor(count: number, max: number): string {
  if (count === 0) return '#f0f0f0';
  if (max === 0) return '#f0f0f0';
  const ratio = count / max;
  if (ratio <= 0.25) return '#c6e48b';
  if (ratio <= 0.5) return '#7bc96f';
  if (ratio <= 0.75) return '#239a3b';
  return '#196127';
}

export default function ClickHeatmap({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">クリック時間帯（JST）</h3>
        <p className="text-sm text-gray-400 text-center py-8">クリックデータがありません</p>
      </div>
    );
  }

  // Build full 168 slots
  const countMap = new Map<string, number>();
  data.forEach((d) => {
    countMap.set(`${d.day}-${d.hour}`, d.count);
  });

  const fullData: Array<{ day: number; hour: number; count: number }> = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      fullData.push({
        day,
        hour,
        count: countMap.get(`${day}-${hour}`) || 0,
      });
    }
  }

  const max = Math.max(...fullData.map((d) => d.count));

  const formatTooltip = (value: number, name: string, props: { payload?: HeatmapData }) => {
    if (name === 'hour' && props.payload) {
      const p = props.payload;
      return [`${DAY_LABELS[p.day]} ${p.hour}時台: ${p.count}クリック`, ''];
    }
    return [value, name];
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">クリック時間帯（JST）</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 30 }}>
          <XAxis
            type="number"
            dataKey="hour"
            domain={[0, 23]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
            tickFormatter={(v) => `${v}時`}
            fontSize={11}
          />
          <YAxis
            type="number"
            dataKey="day"
            domain={[0, 6]}
            ticks={[0, 1, 2, 3, 4, 5, 6]}
            tickFormatter={(v) => DAY_LABELS[v] || ''}
            reversed
            fontSize={11}
          />
          <ZAxis type="number" dataKey="count" range={[80, 80]} />
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const p = payload[0].payload as HeatmapData;
              return (
                <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow">
                  {DAY_LABELS[p.day]} {p.hour}時台: {p.count}クリック
                </div>
              );
            }}
          />
          <Scatter data={fullData}>
            {fullData.map((entry, index) => (
              <Cell key={index} fill={getColor(entry.count, max)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
