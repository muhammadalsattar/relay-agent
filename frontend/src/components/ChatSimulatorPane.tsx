"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Cpu,
  PauseCircle,
  PlayCircle,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";
import { ThreadRecord } from "@/lib/types";

interface ChatSimulatorPaneProps {
  thread: ThreadRecord | null;
  onSendMessage: (content: string, sender: "customer" | "human_agent") => Promise<void>;
  onToggleHandoff: () => Promise<void>;
  isSending: boolean;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatSimulatorPane({
  thread,
  onSendMessage,
  onToggleHandoff,
  isSending,
}: ChatSimulatorPaneProps) {
  const [draft, setDraft] = useState("");
  const [composerRole, setComposerRole] = useState<"customer" | "human_agent">("customer");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.id, thread?.messages.length, isSending]);

  useEffect(() => {
    if (thread?.status !== "human_handoff") {
      setComposerRole("customer");
    }
  }, [thread?.status]);

  if (!thread) {
    return (
      <section className="flex flex-1 items-center justify-center bg-[#090e1a] text-sm text-slate-500">
        Select a conversation thread to start simulating.
      </section>
    );
  }

  const isHandoff = thread.status === "human_handoff";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    await onSendMessage(text, isHandoff ? composerRole : "customer");
  }

  return (
    <section className="flex flex-col h-full bg-[#090e1a] overflow-hidden">
      {/* Chat Header + Human Handoff Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-950/70 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200">
            {thread.customer.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100 truncate">
                {thread.customer.name}
              </h2>
              <span className="rounded-md bg-slate-900 border border-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {thread.channel.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {thread.customer.phone_or_handle} · Intent:{" "}
              <span className="text-slate-200">{thread.customer.intent}</span>
            </p>
          </div>
        </div>

        {/* Human Handoff Toggle */}
        <button
          type="button"
          onClick={onToggleHandoff}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
            isHandoff
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
              : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
          }`}
        >
          {isHandoff ? (
            <>
              <PlayCircle className="h-4 w-4 text-emerald-400" />
              Resume AI
            </>
          ) : (
            <>
              <PauseCircle className="h-4 w-4 text-amber-400" />
              Pause AI / Take Over
            </>
          )}
        </button>
      </div>

      {/* Handoff Banner */}
      {isHandoff && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Human Handoff Active:</strong> Autonomous AI replies are paused.
              Memory extraction still runs on inbound messages.
            </span>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {thread.messages.map((msg) => {
          if (msg.sender === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-[11px] text-slate-400">
                  {msg.content} · {formatTime(msg.timestamp)}
                </div>
              </div>
            );
          }

          const isCustomer = msg.sender === "customer";
          const isHuman = msg.sender === "human_agent";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {isCustomer ? (
                  <User className="h-3 w-3 text-slate-400" />
                ) : isHuman ? (
                  <UserCheck className="h-3 w-3 text-amber-400" />
                ) : (
                  <Bot className="h-3 w-3 text-emerald-400" />
                )}
                <span className="text-[11px] font-medium text-slate-400">
                  {isCustomer
                    ? thread.customer.name
                    : isHuman
                    ? "Human Operator"
                    : "RelayAgent AI"}
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  {formatTime(msg.timestamp)}
                </span>
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border ${
                  isCustomer
                    ? "rounded-tl-sm bg-slate-900/90 border-slate-800 text-slate-100"
                    : isHuman
                    ? "rounded-tr-sm bg-amber-500/15 border-amber-500/30 text-amber-50"
                    : "rounded-tr-sm bg-emerald-500/12 border-emerald-500/30 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Inline Tool-Calling Steps */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1.5">
                    {msg.tool_calls.map((tc, idx) => {
                      const disabled = tc.status.includes("DISABLED");
                      return (
                        <span
                          key={`${msg.id}-tc-${idx}`}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] ${
                            disabled
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                              : "border-emerald-500/25 bg-slate-950/70 text-emerald-300"
                          }`}
                        >
                          <Wrench className="h-2.5 w-2.5" />
                          {tc.tool_name}
                          <span className="text-slate-500">·</span>
                          <span>{tc.latency_ms}ms</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Inline Extracted Memory Pills */}
                {msg.extracted_facts && msg.extracted_facts.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {msg.extracted_facts.map((fact, idx) => (
                      <span
                        key={`${msg.id}-fact-${idx}`}
                        className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200"
                      >
                        <Sparkles className="h-2.5 w-2.5 text-violet-400" />
                        Memory saved: {fact}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Typing / Tool Execution Indicator */}
        {isSending && (
          <div className="flex flex-col items-end">
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-tr-sm border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-200">
              <Cpu className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span>Extracting memory &amp; executing MCP tools...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800/90 bg-slate-950/80 p-3 space-y-2"
      >
        {isHandoff && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-slate-400">Send as:</span>
            <button
              type="button"
              onClick={() => setComposerRole("human_agent")}
              className={`rounded-md px-2 py-0.5 font-medium border ${
                composerRole === "human_agent"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              Human Operator
            </button>
            <button
              type="button"
              onClick={() => setComposerRole("customer")}
              className={`rounded-md px-2 py-0.5 font-medium border ${
                composerRole === "customer"
                  ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              Simulate Customer
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isHandoff && composerRole === "human_agent"
                ? "Reply as human operator..."
                : "Simulate customer message (e.g. 'Book Friday 3 PM, I speak Arabic' or 'Track #ORD-88412')..."
            }
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500/80" />
            Auto-extracts Name, Time, Language, Order ID, Email &amp; Escalation flags
          </span>
          <span className="font-mono">Enter ↵</span>
        </div>
      </form>
    </section>
  );
}
