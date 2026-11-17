import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { EmptyState } from '../ui/States.jsx';
import { BarChart3 } from 'lucide-react';

// Data palette for the dark console (all ≥ 3:1 against the #121821 panel). Signal teal
// is reserved for focus, actions and citations, so it is not a data color.
export const CHART_COLORS = ['#60a5fa', '#a78bfa', '#f5b544', '#4ade80', '#ff6b6b', '#f472b6', '#8a97a8', '#38bdf8'];
const SERIES = { created: '#60a5fa', resolved: '#4ade80' };

const SEAM = '#1f2935';
const axis = { fontSize: 12, fill: '#8a97a8', fontFamily: 'IBM Plex Sans, sans-serif' };
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: `1px solid #2b3746`, background: '#0b0f14', boxShadow: '0 18px 44px -14px rgba(0,0,0,.7)', fontSize: 13, color: '#e6edf5' },
  labelStyle: { color: '#e6edf5' },
  itemStyle: { color: '#e6edf5' },
};

const NoData = () => <EmptyState icon={BarChart3} title="No data for this period" description="Try a wider date range." className="py-10" />;

/** rows: [{ key, count }]. labels maps key → display label. */
export function CategoryBarChart({ rows, labels = {}, height = 260, layout = 'vertical', color = CHART_COLORS[0] }) {
  if (!rows?.length) return <NoData />;
  const data = rows.map((r) => ({ name: labels[r.key] ?? r.key, count: r.count }));
  const horizontal = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 12, bottom: 4, left: horizontal ? 8 : -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={SEAM} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={axis} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: '#18202b' }} />
        <Bar dataKey="count" name="Tickets" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} animationDuration={400} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ rows, labels = {}, height = 240, colors = CHART_COLORS }) {
  if (!rows?.length) return <NoData />;
  const data = rows.map((r) => ({ name: labels[r.key] ?? r.key, value: r.count }));
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="@container"><div className="flex flex-col items-center gap-4 @md:flex-row">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none" animationDuration={400} animationEasing="ease-out">
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[28px] leading-none font-semibold text-slate-900 tabular-nums">{total}</span>
          <span className="text-xs text-slate-500">total</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colors[i % colors.length] }} aria-hidden="true" />
              <span className="text-slate-600">{d.name}</span>
            </span>
            <span className="shrink-0 font-medium whitespace-nowrap text-slate-900 tabular-nums">
              {d.value} <span className="font-normal text-slate-500">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div></div>
  );
}

export function TrendLineChart({ rows, height = 280 }) {
  if (!rows?.length || rows.every((r) => !r.created && !r.resolved)) return <NoData />;
  const data = rows.map((r) => ({ ...r, label: new Date(`${r.bucket}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={SEAM} vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        <Line type="linear" dataKey="created" name="Created" stroke={SERIES.created} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} animationDuration={400} animationEasing="ease-out" />
        <Line type="linear" dataKey="resolved" name="Resolved" stroke={SERIES.resolved} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} animationDuration={400} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  );
}
