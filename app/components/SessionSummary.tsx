"use client";

import Image from "next/image";
import type { SummaryData } from "@/app/api/summary/route";

interface SessionSummaryProps {
  summary: SummaryData;
  onContinue: () => void;
  onNewConversation: () => void;
}

export function SessionSummary({ summary, onContinue, onNewConversation }: SessionSummaryProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-t-3xl bg-zinc-950 pb-8 pt-6 shadow-2xl">
        {/* Handle */}
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-zinc-700" />

        <div className="max-h-[75vh] overflow-y-auto px-6">
          {/* Happy dog */}
          <div className="mb-4 flex justify-center">
            <Image src="/dog-happy.png" alt="Good job!" width={80} height={80} className="select-none" />
          </div>

          <h2 className="mb-6 text-center text-lg font-semibold text-white">Session complete</h2>

          {/* Topic */}
          <Section icon="📖" label="What you practiced">
            <p className="text-sm text-zinc-300">{summary.topic}</p>
          </Section>

          {/* Words learned */}
          {summary.wordsLearned.length > 0 && (
            <Section icon="🟡" label="New words">
              <ul className="space-y-1">
                {summary.wordsLearned.map((w, i) => (
                  <li key={i} className="text-sm text-zinc-300">
                    <span className="font-medium text-amber-400">{w.word}</span>
                    <span className="text-zinc-500"> — </span>
                    {w.translation}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Mistakes */}
          {summary.mistakes.length > 0 && (
            <Section icon="✏️" label="Things to correct">
              <ul className="space-y-2">
                {summary.mistakes.map((m, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-red-400 line-through">{m.error}</span>
                    <span className="text-zinc-500"> → </span>
                    <span className="text-green-400">{m.correction}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Strength */}
          <Section icon="✓" label="What went well">
            <p className="text-sm text-zinc-300">{summary.strength}</p>
          </Section>

          {/* Focus next */}
          <Section icon="→" label="Focus next time">
            <p className="text-sm text-zinc-300">{summary.focusNext}</p>
          </Section>

          {/* Encouragement */}
          <p className="mb-6 text-center text-sm text-amber-400/80 italic">
            {summary.encouragement}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onNewConversation}
              className="w-full rounded-2xl bg-amber-400 py-3 font-medium text-black transition-colors hover:bg-amber-300"
            >
              Start new conversation
            </button>
            <button
              onClick={onContinue}
              className="w-full rounded-2xl border border-zinc-800 py-3 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              Continue this conversation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <span>{icon}</span> {label}
      </p>
      {children}
    </div>
  );
}
