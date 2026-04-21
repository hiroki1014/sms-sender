'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type BucketData = {
  bucket: string;
  count: number;
};

type Props = {
  data: Array<BucketData>;
};

export default function TimeToClickChart({ data }: Props) {
  const hasClicks = data && data.some((d) => d.count > 0);

  if (!hasClicks) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">送信からクリックまでの時間</h3>
        <p className="text-sm text-gray-400 text-center py-8">クリックデータがありません</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">送信からクリックまでの時間</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            fontSize={11}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={11} />
          <Tooltip
            formatter={(value) => [`${value}件`, 'クリック数']}
          />
          <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
