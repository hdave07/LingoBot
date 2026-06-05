"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOnboarding,
  getActiveLanguage,
  getCefrForLanguage,
  getLanguageBaseCode,
  setCefrForLanguage,
  migrateOnboardingData,
} from "@/lib/onboarding";
import { VoicePipeline } from "../components/VoicePipeline";
import { ProgressStrip } from "../components/ProgressStrip";
import { ConversationHistory } from "../components/ConversationHistory";
import type { CefrLevel, TutorLanguage } from "@/lib/onboarding";
import type { VoicePipelineHandle } from "../components/VoicePipeline";

export default function ConversationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("A1");
  const [activeLang, setActiveLang] = useState<TutorLanguage>("es");
  const [anthropicKey] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const pipelineRef = useRef<VoicePipelineHandle>(null);

  useEffect(() => {
    migrateOnboardingData();
    const data = getOnboarding();
    if (!data) {
      router.replace("/onboarding");
      return;
    }
    const lang = getActiveLanguage();
    const baseCode = getLanguageBaseCode(lang);
    setActiveLang(lang);
    setCefrLevel(getCefrForLanguage(baseCode) ?? data.cefrLevel);
    // anthropicKey stays "" — server uses ANTHROPIC_API_KEY env var
    setReady(true);
  }, [router]);

  function handleLevelChange(level: CefrLevel) {
    setCefrLevel(level);
    setCefrForLanguage(getLanguageBaseCode(activeLang), level);
  }

  function handleLanguageChange(lang: TutorLanguage, level: CefrLevel) {
    setActiveLang(lang);
    setCefrLevel(level);
  }

  if (!ready) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Wordmark */}
      <p className="pt-6 text-center text-sm font-bold tracking-[0.2em] text-white uppercase">
        TalkMore
      </p>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-amber-400"
          aria-label="Conversation history"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>

        <ProgressStrip cefrLevel={cefrLevel} onLevelChange={handleLevelChange} />

        <div className="w-8" />
      </div>

      {/* Main */}
      <div className="flex flex-1 items-center justify-center">
        <VoicePipeline
          ref={pipelineRef}
          cefrLevel={cefrLevel}
          anthropicKey={anthropicKey}
          onLanguageChange={handleLanguageChange}
        />
      </div>

      {/* History drawer */}
      <ConversationHistory
        open={historyOpen}
        currentId={pipelineRef.current?.getCurrentId() ?? null}
        currentLanguage={activeLang}
        anthropicKey={anthropicKey}
        onClose={() => setHistoryOpen(false)}
        onLoad={(id) => { pipelineRef.current?.loadConversationById(id); setHistoryOpen(false); }}
        onNewWithLanguage={(lang, level) => {
          pipelineRef.current?.startNewConversationWithLanguage(lang, level);
          setHistoryOpen(false);
        }}
      />
    </div>
  );
}
