"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Globe,
  MapPin,
  MessageCircle,
  PackageSearch,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { ChannelType, ThreadRecord, ThreadStatus } from "@/lib/types";

interface ThreadListPaneProps {
  threads: ThreadRecord[];
  selectedThreadId: string;
  onSelectThread: (threadId: string) => void;
  onRunScenario: (threadId: string, prompt: string) => void;
  isBusy: boolean;
}

const CHANNEL_META: Record<
  ChannelType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  whatsapp: {
    label: "WhatsApp",
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    icon: <MessageCircle className="h-3 w-3" />,
  },
  web_widget: {
    label: "Web Widget",
    color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
    icon: <Globe className="h-3 w-3" />,
  },
  sms: {
    label: "SMS",
    color: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    icon: <Smartphone className="h-3 w-3" />,
  },
};

const STATUS_META: Record<ThreadStatus, { label: string; dot: string; text: string }> = {
  ai_active: {
    label: "AI Active",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  human_handoff: {
    label: "Human Handoff",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-slate-500",
    text: "text-slate-400",
  },
};

const SCENARIOS = [
  {
    label: "Appointment Booking",
    threadId: "thr_whatsapp_01",
    icon: <CalendarClock className="h-3.5 w-3.5 text-emerald-400" />,
    prompt:
      "Can we move my appointment to Thursday at 2:30 PM? I prefer Spanish WhatsApp reminders.",
  },
  {
    label: "Order Status Lookup",
    threadId: "thr_web_02",
    icon: <PackageSearch className="h-3.5 w-3.5 text-indigo-400" />,
    prompt: "Can you track order #ORD-99418? My email is marcus@northstar.io.",
  },
  {
    label: "Urgent Escalation",
    threadId: "thr_whatsapp_01",
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
    prompt:
      "This is urgent — I was double-charged $490 and need a human supervisor immediately!",
  },
  {
    label: "Nearest Branch Lookup",
    threadId: "thr_whatsapp_04",
    icon: <MapPin className="h-3.5 w-3.5 text-cyan-400" />,
    prompt: "Find the nearest downtown service center open past 6 PM today.",
  },
];

export function ThreadListPane({
  threads,
  selectedThreadId,
  onSelectThread,
  onRunScenario,
  isBusy,
}: ThreadListPaneProps) {
  const [filter, setFilter] = useState<"all" | ChannelType>("all");

  const filtered =
    filter === "all" ? threads : threads.filter((t) => t.channel === filter);

  return (
    <aside className="flex flex-col border-r border-slate-800/90 bg-slate-950/60 h-full overflow-hidden">
      {/* Header + Channel Filter */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Conversations
          </h2>
          <span className="font-mono text-[11px] text-slate-500">
            {filtered.length} threads
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {(["all", "whatsapp", "web_widget", "sms"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setFilter(ch)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                filter === ch
                  ? "bg-slate-800 text-slate-100 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
              }`}
            >
              {ch === "all"
                ? "All"
                : ch === "whatsapp"
                ? "WhatsApp"
                : ch === "web_widget"
                ? "Web"
                : "SMS"}
            </button>
          ))}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filtered.map((thread) => {
          const isSelected = thread.id === selectedThreadId;
          const ch = CHANNEL_META[thread.channel];
          const st = STATUS_META[thread.status];
          const lastMsg = thread.messages[thread.messages.length - 1];

          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelectThread(thread.id)}
              className={`w-full text-left p-3.5 transition-colors ${
                isSelected
                  ? "bg-slate-900/95 border-l-2 border-l-emerald-400"
                  : "hover:bg-slate-900/40 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-100 truncate">
                      {thread.customer.name}
                    </span>
                    {thread.customer.vip_tier !== "Standard" && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-300">
                        {thread.customer.vip_tier}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {thread.scenario_tag}
                  </div>
                </div>
                {thread.unread_count > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 px-1.5 font-mono text-[10px] font-semibold text-emerald-300">
                    {thread.unread_count}
                  </span>
                )}
              </div>

              {lastMsg && (
                <p className="mt-2 line-clamp-2 text-xs text-slate-400 leading-relaxed">
                  {lastMsg.content}
                </p>
              )}

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${ch.color}`}
                >
                  {ch.icon}
                  {ch.label}
                </span>

                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${st.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Scenario Presets */}
      <div className="border-t border-slate-800/90 bg-slate-950/90 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          Quick Scenario Presets
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.label}
              type="button"
              disabled={isBusy}
              onClick={() => onRunScenario(sc.threadId, sc.prompt)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-left text-xs text-slate-200 hover:border-slate-700 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
            >
              {sc.icon}
              <span className="truncate font-medium">{sc.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
