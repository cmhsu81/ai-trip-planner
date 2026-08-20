"use client";

import ReactMarkdown, { Components } from "react-markdown";

// AI-generated answers/replies come back as real markdown (headers, bold,
// lists) but render inside modals/chat bubbles, not full pages — so headings
// map to styled paragraphs instead of actual <h1>-<h6> tags, keeping the
// page's own heading outline untouched while still looking distinct.
const components: Components = {
  h1: ({ children }) => <p className="font-semibold mt-3 mb-1 first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="font-semibold mt-3 mb-1 first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="font-semibold mt-2 mb-1 first:mt-0">{children}</p>,
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 space-y-1 mb-2 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 space-y-1 mb-2 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">
      {children}
    </a>
  ),
};

export function MarkdownText({ content }: { content: string }) {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
}
