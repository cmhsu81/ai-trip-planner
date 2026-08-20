"use client";

import Image from "next/image";

interface Props {
  text: string;
}

export function GeneratingOverlay({ text }: Props) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-white/85 backdrop-blur-sm rounded-2xl">
      <Image src="/loading.gif" alt="" width={96} height={96} unoptimized />
      <p className="text-sm font-medium text-teal-700 flex items-center gap-1">
        {text}
        <span className="inline-flex">
          <span className="animate-bounce [animation-delay:0ms]">.</span>
          <span className="animate-bounce [animation-delay:150ms]">.</span>
          <span className="animate-bounce [animation-delay:300ms]">.</span>
        </span>
      </p>
    </div>
  );
}
