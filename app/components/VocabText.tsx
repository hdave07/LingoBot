"use client";

import { useState } from "react";

interface VocabEntry {
  word: string;
  translation: string;
}

interface Segment {
  type: "text" | "vocab";
  content: string;
  translation?: string;
}

function buildSegments(text: string, vocab: VocabEntry[]): Segment[] {
  if (!vocab.length) return [{ type: "text", content: text }];

  const escaped = vocab.map((v) =>
    v.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part) => {
    const match = vocab.find(
      (v) => v.word.toLowerCase() === part.toLowerCase()
    );
    return match
      ? { type: "vocab", content: part, translation: match.translation }
      : { type: "text", content: part };
  });
}

function VocabWord({ word, translation }: { word: string; translation: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        className="cursor-pointer border-b border-dotted border-amber-400 text-amber-300"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {word}
      </span>
      {open && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-700 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
          {translation}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
        </span>
      )}
    </span>
  );
}

export function VocabText({
  text,
  vocab,
}: {
  text: string;
  vocab: VocabEntry[];
}) {
  const segments = buildSegments(text, vocab);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "vocab" ? (
          <VocabWord key={i} word={seg.content} translation={seg.translation!} />
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </>
  );
}
