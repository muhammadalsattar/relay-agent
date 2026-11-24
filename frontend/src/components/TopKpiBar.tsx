"use client";

import {
  Activity,
  Bot,
  Brain,
  Clock,
  Radio,
  Webhook,
} from "lucide-react";
import { ThreadRecord, ToolTraceSpan, WebhookDeliveryLog } from "@/lib/types";

interface TopKpiBarProps {
  threads: ThreadRecord[];
  traces: ToolTraceSpan[];
  webhooks: WebhookDeliveryLog[];
  runtimeMode: string;
}

export function TopKpiBar({
  threads,
  traces,
  webhooks,
  runtimeMode,
}: TopKpiBarProps) {
  const activeCount = threads.filter((t) => t.status !== "resolved").length;
  const aiHandled = threads.filter((t) => t.status !== "human_handoff").length;
  const aiRate = threads.length > 0 ? Math.round((aiHandled / threads.length) * 100) : 0;

  const avgLatency =
    traces.length > 0
      ? Math.round(traces.reduce((acc, s) => acc + s.latency_ms, 0) / traces.length)
      : 0;

  const totalFacts = threads.reduce((acc, t) => acc + t.memory_facts.length, 0);

  return (
    <header className="border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md px-4 lg:px-6 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Brand + Live Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold tracking-tight text-slate-100">
                RelayAgent
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Ops
              </span>
              <span className="hidden sm:inline-flex items-center rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {runtimeMode}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Omnichannel AI Agent, Persistent Memory &amp; Tool-Trace Console
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KpiCard
            icon={<Activity className="h-3.5 w-3.5 text-cyan-400" />}
            label="Active Threads"
            value={String(activeCount)}
            sub={`${threads.length} total`}
          />
          <KpiCard
            icon={<Bot className="h-3.5 w-3.5 text-emerald-400" />}
            label="AI Autonomy"
            value={`${aiRate}%`}
            sub={`${threads.filter((t) => t.status === "human_handoff").length} handoff`}
          />
          <KpiCard
            icon={<Clock className="h-3.5 w-3.5 text-amber-400" />}
            label="Avg Tool Latency"
            value={`${avgLatency}ms`}
            sub={`${traces.length} spans`}
          />
          <KpiCard
            icon={<Brain className="h-3.5 w-3.5 text-violet-400" />}
            label="Memory Facts"
            value={String(totalFacts)}
            sub={
              <span className="inline-flex items-center gap-1">
                <Webhook className="h-2.5 w-2.5" />
                {webhooks.length} hooks
              </span>
            }
          />
        </div>
      </div>
    </header>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-1.5 min-w-[140px]">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-950 border border-slate-800">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
            {value}
          </span>
          <span className="text-[10px] text-slate-500 truncate">{sub}</span>
        </div>
      </div>
    </div>
  );
}
