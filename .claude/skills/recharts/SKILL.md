# Recharts Skill

superbad-hq uses Recharts v3 for data visualisation — revenue metrics, social metrics, pipeline analytics, and ad performance.

---

## Core Pattern

```tsx
'use client'  // Recharts requires client components
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const data = [
  { month: 'Jan', revenue: 12500, target: 15000 },
  { month: 'Feb', revenue: 18000, target: 15000 },
]

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(253,245,230,0.1)" />
        <XAxis dataKey="month" tick={{ fill: '#FDF5E6', fontSize: 12 }} />
        <YAxis tick={{ fill: '#FDF5E6', fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line type="monotone" dataKey="revenue" stroke="#B22848" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="target" stroke="#F28C52" strokeWidth={1} strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

---

## Always Use `ResponsiveContainer`

Never set fixed `width` on charts — always wrap in `ResponsiveContainer`:

```tsx
// ❌ Fixed width — breaks on mobile
<LineChart width={600} height={300} data={data} />

// ✅ Responsive
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data} />
</ResponsiveContainer>
```

---

## Chart Type Reference

| Data pattern | Chart type | Component |
|---|---|---|
| Trend over time | Line | `LineChart` |
| Compare categories | Bar | `BarChart` |
| Part of whole | Pie/Donut | `PieChart` |
| Cumulative | Area | `AreaChart` |
| Two metrics, different scales | Composed | `ComposedChart` |
| Distribution | Bar (histogram) | `BarChart` |

---

## SuperBad Brand Colours for Charts

```typescript
const CHART_COLOURS = {
  primary: '#B22848',    // SuperBad Red — main metric
  accent: '#F28C52',     // Retro Orange — secondary metric
  pink: '#F4A0B0',       // Retro Pink — tertiary
  muted: 'rgba(253,245,230,0.4)',  // Warm Cream at 40% — grid, guides
  text: '#FDF5E6',       // Warm Cream — axis labels
}

// For multi-series charts
const SERIES_COLOURS = ['#B22848', '#F28C52', '#F4A0B0', 'rgba(253,245,230,0.6)']
```

---

## Custom Tooltip

```tsx
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-white/10 bg-[#1A1A18] px-4 py-3 shadow-xl">
      <p className="mb-2 text-sm font-medium text-[#FDF5E6]/60">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' && entry.value > 1000
            ? `$${(entry.value / 1000).toFixed(1)}k`
            : entry.value}
        </p>
      ))}
    </div>
  )
}
```

---

## Bar Chart

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export function PipelineChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="rgba(253,245,230,0.08)" />
        <XAxis dataKey="stage" tick={{ fill: '#FDF5E6', fontSize: 11 }} />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(253,245,230,0.05)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? '#B22848' : 'rgba(178,40,72,0.4)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

---

## Area Chart (with gradient fill)

```tsx
import { AreaChart, Area, defs, linearGradient, stop } from 'recharts'

export function RevenueAreaChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#B22848" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#B22848" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#B22848"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={false}
        />
        <XAxis dataKey="date" tick={{ fill: '#FDF5E6', fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

---

## Pie / Donut Chart

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

// Max 5 segments — use bar chart if more
export function ServiceMixChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}   // Remove for solid pie
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLOURS[i % SERIES_COLOURS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#FDF5E6' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

---

## Loading and Empty States

```tsx
// Skeleton while loading
if (isLoading) return <div className="h-[300px] animate-pulse rounded-lg bg-white/5" />

// Empty state
if (!data.length) return (
  <div className="flex h-[300px] flex-col items-center justify-center gap-2">
    <p className="text-sm text-[#FDF5E6]/40">No data yet</p>
    <p className="text-xs text-[#FDF5E6]/20">Data will appear once you have activity</p>
  </div>
)
```

---

## Accessibility

- Always add `aria-label` to the chart container
- Provide a data table alternative for screen readers (visually hidden)
- Never convey information by colour alone — use labels or patterns

```tsx
<ResponsiveContainer width="100%" height={300} aria-label="Revenue over time chart">
```
