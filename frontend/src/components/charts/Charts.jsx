import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { EmptyState } from '../ui/States.jsx';
import { BarChart3 } from 'lucide-react';

// Categorical palette: brand indigo first, then distinguishable, accessible hues.
export const CHART_COLORS = ['#3f47a8', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#ec4899'];

const axis = { fontSize: 12, fill: '#64748b' };
const tooltipStyle = { contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -10px rgba(15,23,42,.25)', fontSize: 13 } };

const NoData = () => <EmptyState icon={BarChart3} title="No data for this period" description="Try a wider date range." className="py-10" />;

/** rows: [{ key, count }]. labels maps key → display label. */
export function CategoryBarChart({ rows, labels = {}, height = 260, layout = 'vertical', color = CHART_COLORS[0] }) {
  if (!rows?.length) return <NoData />;
  const data = rows.map((r) => ({ name: labels[r.key] ?? r.key, count: r.count }));
  const horizontal = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 12, bottom: 4, left: horizontal ? 8 : -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!horizontal} vertical={horizontal} />
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
        <Tooltip {...tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="count" name="Tickets" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ rows, labels = {}, height = 240, colors = CHART_COLORS }) {
  if (!rows?.length) return <NoData />;
  const data = rows.map((r) => ({ name: labels[r.key] ?? r.key, value: r.count }));
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">{total}</span>
          <span className="text-xs text-slate-500">total</span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colors[i % colors.length] }} aria-hidden="true" />
              <span className="truncate text-slate-600">{d.name}</span>
            </span>
            <span className="font-medium text-slate-900 tabular-nums">
              {d.value} <span className="font-normal text-slate-500">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendLineChart({ rows, height = 280 }) {
  if (!rows?.length || rows.every((r) => !r.created && !r.resolved)) return <NoData />;
  const data = rows.map((r) => ({ ...r, label: new Date(`${r.bucket}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />
        <Line type="linear" dataKey="created" name="Created" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        <Line type="linear" dataKey="resolved" name="Resolved" stroke={CHART_COLORS[2]} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
