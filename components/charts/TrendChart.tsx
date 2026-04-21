'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type TrendData = {
  name: string;
  delivery_rate: number;
  click_rate: number;
};

type Props = {
  data: Array<TrendData>;
};

export default function TrendChart({ data }: Props) {
  if (!data || data.length < 2) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">到達率・クリック率の推移</h3>
        <p className="text-sm text-gray-400 text-center py-8">
          推移を表示するには2件以上のキャンペーンが必要です
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">到達率・クリック率の推移</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            fontSize={11}
            tickFormatter={(v: string) => (v.length > 10 ? v.slice(0, 10) + '…' : v)}
          />
          <YAxis domain={[0, 100]} unit="%" fontSize={11} />
          <Tooltip
            formatter={(value, name) => {
              const label = name === 'delivery_rate' ? '到達率' : 'クリック率';
              return [`${value}%`, label];
            }}
          />
          <Legend
            formatter={(value: string) =>
              value === 'delivery_rate' ? '到達率' : 'クリック率'
            }
          />
          <Line
            type="monotone"
            dataKey="delivery_rate"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="click_rate"
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
