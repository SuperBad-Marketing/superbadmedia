"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import type {
  FunnelData,
  ApprovalSparklinePoint,
  WarmupProgress,
} from "@/lib/lead-gen/queries";

interface MetricsPanelProps {
  funnel: FunnelData;
  saasSparkline: ApprovalSparklinePoint[];
  retainerSparkline: ApprovalSparklinePoint[];
  warmup: WarmupProgress;
}

export function MetricsPanel({
  funnel,
  saasSparkline,
  retainerSparkline,
  warmup,
}: MetricsPanelProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <FunnelChart data={funnel} />
      <ApprovalSparklines
        saas={saasSparkline}
        retainer={retainerSparkline}
      />
      <AutonomyStreak />
      <WarmupCard warmup={warmup} />
    </div>
  );
}

function FunnelChart({ data }: { data: FunnelData }) {
  const chartData = [
    { name: "Found", value: data.found },
    { name: "Qualified", value: data.qualified },
    { name: "DNC", value: data.dncFiltered },
    { name: "Drafted", value: data.drafted },
    { name: "Sent", value: data.sent },
    { name: "Opened", value: data.opened },
    { name: "Clicked", value: data.clicked },
    { name: "Replied", value: data.replied },
  ];

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">Funnel (30 days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="var(--color-brand-red, #B22848)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ApprovalSparklines({
  saas,
  retainer,
}: {
  saas: ApprovalSparklinePoint[];
  retainer: ApprovalSparklinePoint[];
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">
        Approval Rate (30 days, per track)
      </h3>
      <div className="space-y-4">
        <SparklineRow label="SaaS" data={saas} color="#F28C52" />
        <SparklineRow label="Retainer" data={retainer} color="#B22848" />
      </div>
    </div>
  );
}

function SparklineRow({
  label,
  data,
  color,
}: {
  label: string;
  data: ApprovalSparklinePoint[];
  color: string;
}) {
  if (data.length === 0) {
    return (
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-xs text-muted-foreground mt-1">No data yet</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <ResponsiveContainer width="100%" height={60}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <Line
            type="monotone"
            dataKey="rate"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-1)",
              borderColor: "var(--color-border)",
              fontSize: 11,
            }}
            formatter={(value) => [`${value}%`, "Clean approval"]}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AutonomyStreak() {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">Autonomy Streak (per track)</h3>
      <div className="space-y-3 font-mono text-sm">
        <div className="rounded border border-border/50 p-3">
          <p className="font-medium">SaaS · manual</p>
          <p className="text-muted-foreground text-xs mt-1">
            Autonomy state machine ships in LG-8
          </p>
        </div>
        <div className="rounded border border-border/50 p-3">
          <p className="font-medium">Retainer · manual</p>
          <p className="text-muted-foreground text-xs mt-1">
            Autonomy state machine ships in LG-8
          </p>
        </div>
      </div>
    </div>
  );
}

function WarmupCard({ warmup }: { warmup: WarmupProgress }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium">Warmup Progress</h3>
      <div className="font-mono text-sm space-y-1">
        {warmup.isGraduated ? (
          <>
            <p>Graduated · daily cap {warmup.cap}</p>
            <p className="text-muted-foreground">
              Used {warmup.used}/{warmup.cap} today
            </p>
          </>
        ) : (
          <>
            <p>
              Week {warmup.currentWeek} · daily cap {warmup.cap} · used{" "}
              {warmup.used}/{warmup.cap} today
            </p>
            {warmup.daysUntilNextRamp != null && (
              <p className="text-muted-foreground">
                {warmup.daysUntilNextRamp} day
                {warmup.daysUntilNextRamp === 1 ? "" : "s"} until next ramp
              </p>
            )}
          </>
        )}

        <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-[color:var(--color-brand-red,#B22848)] transition-all"
            style={{
              width: `${warmup.cap > 0 ? Math.min((warmup.used / warmup.cap) * 100, 100) : 0}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
