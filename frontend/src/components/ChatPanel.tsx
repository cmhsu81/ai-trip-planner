"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { DisplayChatMessage } from "@/types";

interface Props {
  messages: DisplayChatMessage[];
  onSend: (message: string) => Promise<void>;
  onAccept: (message: DisplayChatMessage) => Promise<void>;
  onReject: (message: DisplayChatMessage) => void;
  pendingMessage?: string;
}

export function ChatPanel({ messages, onSend, onAccept, onReject, pendingMessage }: Props) {
  const { t } = useLocale();
  const [input, setInput] = useState(pendingMessage ?? "");
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    // prefill the input when the parent suggests a message (e.g. "ask AI to replace this item")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pendingMessage) setInput(pendingMessage);
  }, [pendingMessage]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const message = input;
    setInput("");
    try {
      await onSend(message);
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(message: DisplayChatMessage) {
    setApplyingId(message.id);
    try {
      await onAccept(message);
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg flex flex-col h-[420px]">
      <div className="px-3 py-2 border-b border-slate-200 font-medium text-sm">
        {t("chat.title")}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[85%]">
              <div
                className={`text-sm rounded-lg px-3 py-2 ${
                  m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.isChangeRequest && (
                <div className="mt-1">
                  {!m.resolution ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(m)}
                        disabled={applyingId === m.id}
                        className="text-xs bg-slate-900 text-white rounded px-3 py-1 disabled:opacity-50"
                      >
                        {applyingId === m.id ? t("common.loading") : t("chat.applyYes")}
                      </button>
                      <button
                        onClick={() => onReject(m)}
                        className="text-xs border border-slate-300 rounded px-3 py-1"
                      >
                        {t("chat.applyNo")}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">
                      {m.resolution === "applied" ? t("chat.applied") : t("chat.dismissed")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && <div className="text-xs text-slate-400">{t("chat.thinking")}</div>}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-slate-200">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-slate-900 text-white rounded px-4 text-sm disabled:opacity-50"
        >
          {t("chat.send")}
        </button>
      </form>
    </div>
  );
}
