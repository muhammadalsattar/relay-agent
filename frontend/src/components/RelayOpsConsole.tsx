"use client";

import { useCallback, useEffect, useState } from "react";
import {
  APIEnvelope,
  MemoryCategory,
  ThreadRecord,
  ToolRegistryItem,
  ToolTraceSpan,
  WebhookDeliveryLog,
} from "@/lib/types";
import { TopKpiBar } from "./TopKpiBar";
import { ThreadListPane } from "./ThreadListPane";
import { ChatSimulatorPane } from "./ChatSimulatorPane";
import { InspectorPane } from "./InspectorPane";

export function RelayOpsConsole() {
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [traces, setTraces] = useState<ToolTraceSpan[]>([]);
  const [tools, setTools] = useState<ToolRegistryItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookDeliveryLog[]>([]);
  const [runtimeMode, setRuntimeMode] = useState<string>("initializing");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  const refreshAll = useCallback(async () => {
    try {
      const [healthRes, threadsRes, tracesRes, toolsRes] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/threads", { cache: "no-store" }),
        fetch("/api/traces", { cache: "no-store" }),
        fetch("/api/tools", { cache: "no-store" }),
      ]);

      if (healthRes.ok) {
        const h = (await healthRes.json()) as APIEnvelope<{
          service: string;
          llm_mode: string;
        }>;
        setRuntimeMode(
          h.data.service === "relay-agent-backend"
            ? `FastAPI · ${h.data.llm_mode}`
            : `Edge Runtime · ${h.data.llm_mode}`
        );
      }

      if (threadsRes.ok) {
        const t = (await threadsRes.json()) as APIEnvelope<{
          threads: ThreadRecord[];
        }>;
        setThreads(t.data.threads);
        setSelectedThreadId((prev) =>
          prev && t.data.threads.some((x) => x.id === prev)
            ? prev
            : t.data.threads[0]?.id ?? ""
        );
      }

      if (tracesRes.ok) {
        const tr = (await tracesRes.json()) as APIEnvelope<{
          traces: ToolTraceSpan[];
        }>;
        setTraces(tr.data.traces);
      }

      if (toolsRes.ok) {
        const tl = (await toolsRes.json()) as APIEnvelope<{
          tools: ToolRegistryItem[];
          webhooks: WebhookDeliveryLog[];
        }>;
        setTools(tl.data.tools);
        setWebhooks(tl.data.webhooks);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const activeThread =
    threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null;

  async function handleSendMessage(
    content: string,
    sender: "customer" | "human_agent" = "customer",
    overrideThreadId?: string
  ) {
    const targetId = overrideThreadId ?? activeThread?.id;
    if (!targetId) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/threads/${targetId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sender }),
      });
      if (res.ok) {
        await refreshAll();
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleRunScenario(threadId: string, prompt: string) {
    setSelectedThreadId(threadId);
    await handleSendMessage(prompt, "customer", threadId);
  }

  async function handleToggleHandoff() {
    if (!activeThread) return;
    const res = await fetch(`/api/threads/${activeThread.id}/handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      await refreshAll();
    }
  }

  async function handleUpsertFact(
    key: string,
    value: string,
    category: MemoryCategory
  ) {
    if (!activeThread) return;
    const res = await fetch(`/api/threads/${activeThread.id}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, category }),
    });
    if (res.ok) {
      await refreshAll();
    }
  }

  async function handleDeleteFact(factId: string) {
    if (!activeThread) return;
    const res = await fetch(`/api/threads/${activeThread.id}/memory/${factId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await refreshAll();
    }
  }

  async function handleToggleTool(toolName: string, enabled: boolean) {
    const res = await fetch("/api/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: toolName, enabled }),
    });
    if (res.ok) {
      await refreshAll();
    }
  }

  async function handleSimulateWebhook() {
    setIsSending(true);
    try {
      const targetId = activeThread?.id ?? "thr_whatsapp_01";
      const res = await fetch("/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: targetId,
          from_number: activeThread?.customer.phone_or_handle ?? "+14155550192",
          sender_name: activeThread?.customer.name ?? "Sarah Jenkins",
          message_text:
            "WhatsApp webhook ping: Can you confirm my Friday 3:00 PM slot and check order #ORD-88412?",
        }),
      });
      if (res.ok) {
        await refreshAll();
      }
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-sm text-slate-400">
        Loading RelayAgent Ops Console...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#070b14] overflow-hidden">
      <TopKpiBar
        threads={threads}
        traces={traces}
        webhooks={webhooks}
        runtimeMode={runtimeMode}
      />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_360px] xl:grid-cols-[320px_1fr_390px] min-h-0 overflow-hidden">
        <ThreadListPane
          threads={threads}
          selectedThreadId={activeThread?.id ?? ""}
          onSelectThread={setSelectedThreadId}
          onRunScenario={handleRunScenario}
          isBusy={isSending}
        />

        <ChatSimulatorPane
          thread={activeThread}
          onSendMessage={(content, sender) => handleSendMessage(content, sender)}
          onToggleHandoff={handleToggleHandoff}
          isSending={isSending}
        />

        <InspectorPane
          thread={activeThread}
          traces={traces}
          tools={tools}
          webhooks={webhooks}
          onUpsertFact={handleUpsertFact}
          onDeleteFact={handleDeleteFact}
          onToggleTool={handleToggleTool}
          onSimulateWebhook={handleSimulateWebhook}
          isBusy={isSending}
        />
      </main>
    </div>
  );
}
