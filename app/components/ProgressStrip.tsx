"use client";

import { useEffect, useState } from "react";
import { getProgress } from "@/lib/progress";
import type { CefrLevel } from "@/lib/onboarding";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const levelColor: Record<CefrLevel, string> = {
  A1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  A2: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25",
  B1: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  B2: "bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25",
  C1: "bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25",
  C2: "bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25",
};

interface ProgressStripProps {
  cefrLevel: CefrLevel;
  onLevelChange?: (level: CefrLevel) => void;
}

export function ProgressStrip({ cefrLevel, onLevelChange }: ProgressStripProps) {
  const [sessions, setSessions] = useState(0);
  const [streak, setStreak] = useState(0);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const p = getProgress();
      setSessions(p.sessions);
      setStreak(p.streak);
    };
    refresh();
    window.addEventListener("lingobot:progress", refresh);
    return () => window.removeEventListener("lingobot:progress", refresh);
  }, []);

  function handleLevelClick() {
    if (!onLevelChange) return;
    const idx = LEVELS.indexOf(cefrLevel);
    const next = LEVELS[(idx + 1) % LEVELS.length];
    onLevelChange(next);
    setJustChanged(true);
    setTimeout(() => setJustChanged(false), 600);
  }

  return (
    <div className="flex items-center justify-center gap-4 rounded-full border border-zinc-800 bg-zinc-900/60 px-6 py-2.5">
      {/* Level badge */}
      <div className="flex items-baseline gap-1.5">
        {onLevelChange ? (
          <button
            onClick={handleLevelClick}
            title="Tap to change difficulty"
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-all cursor-pointer ${levelColor[cefrLevel]} ${justChanged ? "scale-125" : "scale-100"}`}
          >
            {cefrLevel}
          </button>
        ) : (
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${levelColor[cefrLevel].split(" hover:")[0]}`}
          >
            {cefrLevel}
          </span>
        )}
        <span className="text-xs text-zinc-600">difficulty</span>
      </div>

      <Divider />

      {/* Sessions */}
      <Stat value={sessions} label={sessions === 1 ? "session" : "sessions"} />

      <Divider />

      {/* Streak */}
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none">🔥</span>
        <span className="text-sm font-semibold text-white">{streak}</span>
        <span className="text-xs text-zinc-600">
          {streak === 1 ? "day" : "days"}
        </span>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm font-semibold text-white">{value}</span>
      <span className="text-xs text-zinc-600">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-amber-500/30">·</span>;
}
