'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/trends';
import { formatDelta, weekDelta } from '@/lib/trends';

/** شكل نقطة المخطط: نقطة الاتجاه + نص الفرق للـ tooltip. */
type ChartDatum = TrendPoint & { deltaText: string };

/**
 * مخطط أعمدة أسبوعي مقارن (إضافة/تعديل/حذف لكل أسبوع) مع سطر فرق تحت الأسبوع.
 * اتجاه المحاور LTR والنصوص عربية في التسميات وال tooltip — نفس نمط تقرير النشاط.
 */
export default function ActivityWeeklyChart({
  series,
  height = 250,
}: {
  series: TrendPoint[];
  height?: number;
}) {
  // الرسم من الأقدم إلى الأحدث ليقرأ الزمن من اليمين (RTL) طبيعياً
  const data = [...series].reverse().map((point) => ({
    ...point,
    label: point.label.split(' – ')[0],
    deltaText: formatDelta(weekDelta(point, series)),
  }));

  return (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-variant)', opacity: 0.5 }}
            formatter={(value: any, name: any) => [`${value}`, name]}
            labelFormatter={(_label: any, payload: any) => {
              const point = payload?.[0]?.payload as ChartDatum | undefined;
              const deltaLine = point?.deltaText ? ` • ${point.deltaText}` : '';
              return `أسبوع ${point?.label ?? _label}${deltaLine}`;
            }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 12,
              direction: 'rtl',
            }}
          />
          <Legend
            formatter={(value: string) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
          />
          <Bar dataKey="created" name="إضافات" fill="var(--green)" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="updated" name="تعديلات" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar dataKey="deleted" name="حذف" fill="var(--error)" radius={[3, 3, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
