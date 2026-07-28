"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, icon = "💡", onClose, children }: Props) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <span className="text-lg">{icon}</span> {title}
          </h3>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-lg leading-none transition-colors"
          >
            &times;
          </button>
        </div>
        <div className="p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  );
}
