'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type TagData = {
  tag: string;
  sent: number;
  clicked: number;
  rate: number;
};

type Props = {
  data: Array<TagData>;
};

export default function TagBreakdownChart({ data }: Props) {
  if (!data || data.length === 0) {
    return null;
  }

  const height = Math.max(150, data.length * 40 + 40);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">タグ別クリック率</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
        >
          <XAxis type="number" domain={[0, 100]} unit="%" fontSize={11} />
          <YAxis
            type="category"
            dataKey="tag"
            width={55}
            fontSize={11}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const item = payload[0].payload as TagData;
              return (
                <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs shadow">
                  <p className="font-medium">{item.tag}</p>
                  <p>クリック率: {item.rate}%</p>
                  <p>送信数: {item.sent}件</p>
                  <p>クリック数: {item.clicked}件</p>
                </div>
              );
            }}
          />
          <Bar dataKey="rate" fill="#F59E0B" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
