"use client";

import { useState } from "react";
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronRight,
  Edit3,
  Plus,
  Send,
  Trash2,
  Webhook,
  Wrench,
  X,
} from "lucide-react";
import {
  MemoryCategory,
  MemoryFact,
  ThreadRecord,
  ToolRegistryItem,
  ToolTraceSpan,
  WebhookDeliveryLog,
} from "@/lib/types";

interface InspectorPaneProps {
  thread: ThreadRecord | null;
  traces: ToolTraceSpan[];
  tools: ToolRegistryItem[];
  webhooks: WebhookDeliveryLog[];
  onUpsertFact: (key: string, value: string, category: MemoryCategory) => Promise<void>;
  onDeleteFact: (factId: string) => Promise<void>;
  onToggleTool: (toolName: string, enabled: boolean) => Promise<void>;
  onSimulateWebhook: () => Promise<void>;
  isBusy: boolean;
}

type InspectorTab = "memory" | "traces" | "webhooks";

const CATEGORY_STYLE: Record<MemoryCategory, string> = {
  identity: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  preference: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  intent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  order: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  contact: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  escalation: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export function InspectorPane({
  thread,
  traces,
  tools,
  webhooks,
  onUpsertFact,
  onDeleteFact,
  onToggleTool,
  onSimulateWebhook,
  isBusy,
}: InspectorPaneProps) {
  const [tab, setTab] = useState<InspectorTab>("memory");
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [factKey, setFactKey] = useState("");
  const [factValue, setFactValue] = useState("");
  const [factCategory, setFactCategory] = useState<MemoryCategory>("preference");

  function startEdit(fact: MemoryFact) {
    setFactKey(fact.key);
    setFactValue(fact.value);
    setFactCategory(fact.category);
    setShowAddForm(true);
  }

  async function handleSaveFact(e: React.FormEvent) {
    e.preventDefault();
    if (!factKey.trim() || !factValue.trim()) return;
    await onUpsertFact(factKey.trim(), factValue.trim(), factCategory);
    setFactKey("");
    setFactValue("");
    setShowAddForm(false);
  }

  const maxLatency = Math.max(200, ...traces.map((t) => t.latency_ms));

  return (
    <aside className="flex flex-col border-l border-slate-800/90 bg-slate-950/60 h-full overflow-hidden">
      {/* Tab Bar */}
      <div className="grid grid-cols-3 border-b border-slate-800/90 bg-slate-950 p-1.5 gap-1">
        <TabButton
          active={tab === "memory"}
          onClick={() => setTab("memory")}
          icon={<Brain className="h-3.5 w-3.5" />}
          label="Memory"
          count={thread?.memory_facts.length ?? 0}
        />
        <TabButton
          active={tab === "traces"}
          onClick={() => setTab("traces")}
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Traces"
          count={traces.length}
        />
        <TabButton
          active={tab === "webhooks"}
          onClick={() => setTab("webhooks")}
          icon={<Webhook className="h-3.5 w-3.5" />}
          label="MCP / Hooks"
          count={tools.filter((t) => t.enabled).length}
        />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {tab === "memory" && thread && (
          <>
            {/* Structured Customer Profile */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Customer Profile
                </span>
                <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {thread.customer.vip_tier}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <ProfileField label="Name" value={thread.customer.name} />
                <ProfileField label="Language" value={thread.customer.language} />
                <ProfileField
                  label="Preferred Time"
                  value={thread.customer.preferred_time}
                />
                <ProfileField label="Intent" value={thread.customer.intent} />
              </dl>
            </div>

            {/* Extracted Memory Chips */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Persistent Memory Chips
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFactKey("");
                    setFactValue("");
                    setFactCategory("preference");
                    setShowAddForm((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                >
                  {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showAddForm ? "Cancel" : "Add Fact"}
                </button>
              </div>

              {showAddForm && (
                <form
                  onSubmit={handleSaveFact}
                  className="rounded-xl border border-violet-500/30 bg-slate-900/90 p-3 space-y-2"
                >
                  <input
                    type="text"
                    placeholder="Fact key (e.g. Preferred Time, Timezone)"
                    value={factKey}
                    onChange={(e) => setFactKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. UTC+2, Fridays 3 PM)"
                    value={factValue}
                    onChange={(e) => setFactValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={factCategory}
                      onChange={(e) =>
                        setFactCategory(e.target.value as MemoryCategory)
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                    >
                      <option value="preference">preference</option>
                      <option value="identity">identity</option>
                      <option value="intent">intent</option>
                      <option value="order">order</option>
                      <option value="contact">contact</option>
                      <option value="escalation">escalation</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-violet-400"
                    >
                      Save Fact
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {thread.memory_facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="group rounded-xl border border-slate-800/90 bg-slate-900/50 p-2.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-200">
                            {fact.key}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase ${
                              CATEGORY_STYLE[fact.category]
                            }`}
                          >
                            {fact.category}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300 break-words">
                          {fact.value}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                        <button
                          type="button"
                          title="Edit fact"
                          onClick={() => startEdit(fact)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete fact"
                          onClick={() => onDeleteFact(fact.id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>source: {fact.source}</span>
                      <span>conf: {Math.round(fact.confidence * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "traces" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tool-Execution Waterfall
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {traces.length} spans
              </span>
            </div>

            {traces.map((span) => {
              const isOpen = expandedTraceId === span.id;
              const widthPct = Math.max(
                10,
                Math.min(100, Math.round((span.latency_ms / maxLatency) * 100))
              );
              const isError = span.status.includes("DISABLED") || span.status.includes("ERROR");

              return (
                <div
                  key={span.id}
                  className="rounded-xl border border-slate-800/90 bg-slate-900/60 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedTraceId(isOpen ? null : span.id)}
                    className="w-full p-2.5 text-left hover:bg-slate-900/90 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        <Wrench className="h-3 w-3 text-cyan-400 shrink-0" />
                        <span className="font-mono text-xs font-semibold text-slate-100 truncate">
                          {span.tool_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            isError
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {span.status}
                        </span>
                        <span className="font-mono text-[11px] text-slate-300 tabular-nums">
                          {span.latency_ms}ms
                        </span>
                      </div>
                    </div>

                    {/* Latency Waterfall Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isError ? "bg-rose-500" : "bg-gradient-to-r from-emerald-500 to-cyan-400"
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                      <span className="truncate">{span.request_id}</span>
                      <span>{span.thread_id}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-800 bg-slate-950/90 p-2.5 space-y-2 font-mono text-[11px]">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                          Input Payload
                        </div>
                        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2 text-cyan-200">
                          {JSON.stringify(span.input_payload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                          Output Payload
                        </div>
                        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2 text-emerald-200">
                          {JSON.stringify(span.output_payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "webhooks" && (
          <div className="space-y-4">
            {/* Tool Registry */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                MCP &amp; Tool Registry
              </span>
              {tools.map((tool) => (
                <div
                  key={tool.name}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-100">
                          {tool.name}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">
                          {tool.protocol}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                        {tool.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleTool(tool.name, !tool.enabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        tool.enabled ? "bg-emerald-500" : "bg-slate-700"
                      }`}
                      aria-label={`Toggle ${tool.name}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                          tool.enabled ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
                    <span>avg {tool.avg_latency_ms}ms</span>
                    <span>{tool.calls_count} calls</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Inbound Webhook Simulator + Delivery Log */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Webhook Delivery Log
                </span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onSimulateWebhook}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  Test WhatsApp Hook
                </button>
              </div>

              <div className="space-y-2">
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          wh.direction === "inbound"
                            ? "bg-cyan-500/15 text-cyan-300"
                            : "bg-violet-500/15 text-violet-300"
                        }`}
                      >
                        {wh.direction}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300">
                        {wh.status_code} · {wh.latency_ms}ms
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-200 truncate">
                      {wh.event_type}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500 truncate">
                      {wh.endpoint}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-slate-800 text-slate-100 shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span className="rounded bg-slate-950 px-1 font-mono text-[10px] text-slate-400">
        {count}
      </span>
    </button>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/70 border border-slate-800/70 p-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-slate-200 truncate" title={value}>
        {value}
      </dd>
    </div>
  );
}
