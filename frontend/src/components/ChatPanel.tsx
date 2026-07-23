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
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col h-[480px] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 font-medium text-sm bg-gradient-to-r from-teal-50 to-white flex items-center gap-2">
        <span>🧭</span> {t("chat.title")}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-slate-400 text-center pt-6">{t("chat.placeholder")}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start gap-2"}>
            {m.role === "assistant" && (
              <span className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-teal-100 text-xs">
                🧭
              </span>
            )}
            <div className="max-w-[80%]">
              <div
                className={`text-sm px-3.5 py-2.5 ${
                  m.role === "user"
                    ? "bg-teal-600 text-white rounded-2xl rounded-br-sm shadow-sm"
                    : "bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.isChangeRequest && (
                <div className="mt-1.5 ml-0.5">
                  {!m.resolution ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(m)}
                        disabled={applyingId === m.id}
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-full px-3.5 py-1.5 disabled:opacity-50 transition-colors"
                      >
                        {applyingId === m.id ? t("common.loading") : t("chat.applyYes")}
                      </button>
                      <button
                        onClick={() => onReject(m)}
                        className="text-xs border border-slate-300 rounded-full px-3.5 py-1.5 hover:bg-slate-50"
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
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-teal-100 text-xs">
              🧭
            </span>
            {t("chat.thinking")}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-slate-100 bg-slate-50/50">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/60 focus:border-teal-500 bg-white"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-4 text-sm disabled:opacity-50 transition-colors"
        >
          {t("chat.send")}
        </button>
      </form>
    </div>
  );
}
