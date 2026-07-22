"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  pendingMessage?: string;
}

export function ChatPanel({ messages, onSend, pendingMessage }: Props) {
  const { t } = useLocale();
  const [input, setInput] = useState(pendingMessage ?? "");

  useEffect(() => {
    // prefill the input when the parent suggests a message (e.g. "ask AI to replace this item")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pendingMessage) setInput(pendingMessage);
  }, [pendingMessage]);
  const [sending, setSending] = useState(false);

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

  return (
    <div className="border border-slate-200 rounded-lg flex flex-col h-[420px]">
      <div className="px-3 py-2 border-b border-slate-200 font-medium text-sm">
        {t("chat.title")}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm max-w-[85%] rounded-lg px-3 py-2 ${
              m.role === "user"
                ? "ml-auto bg-slate-900 text-white"
                : "bg-slate-100 text-slate-800"
            }`}
          >
            {m.content}
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
