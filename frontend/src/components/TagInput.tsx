"use client";

import { KeyboardEvent, useState } from "react";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagInput({ values, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState("");

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-teal-500/60 focus-within:border-teal-500 transition-shadow">
      {values.map((v, i) => (
        <span
          key={v}
          className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-800 text-sm rounded-md pl-2 pr-2.5 py-1"
        >
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-teal-500 hover:text-red-500 transition-colors leading-none"
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
          {v}
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] outline-none text-sm py-1 bg-transparent"
      />
    </div>
  );
}
