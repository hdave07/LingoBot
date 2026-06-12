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
  getAnthropicKey,
  saveAnthropicKey,
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
  const [anthropicKey, setAnthropicKey] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
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

    const storedKey = getAnthropicKey();
    setAnthropicKey(storedKey);

    // If no key in storage, check whether the server has one; if not, prompt the user
    if (!storedKey) {
      fetch("/api/has-key")
        .then((r) => r.json())
        .then(({ serverKeySet }: { serverKeySet: boolean }) => {
          if (!serverKeySet) setShowKeyModal(true);
        })
        .catch(() => {});
    }

    setReady(true);
  }, [router]);

  function handleSaveKey() {
    const trimmed = keyInput.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      setKeyError("Should start with sk-ant-");
      return;
    }
    saveAnthropicKey(trimmed);
    setAnthropicKey(trimmed);
    setShowKeyModal(false);
    setKeyInput("");
    setKeyError("");
  }

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

        <button
          onClick={() => { setKeyInput(anthropicKey); setKeyError(""); setShowKeyModal(true); }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-amber-400"
          aria-label="API key settings"
          title="API key settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M11 12l8.5-8.5M18 3l3 3-1.5 1.5-3-3M14.5 6.5l3 3" />
          </svg>
        </button>
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

      {/* API key modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-semibold text-white">Anthropic API key</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Stored only in your browser. Get one at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                console.anthropic.com
              </a>
              .
            </p>

            <input
              type="password"
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); }}
              placeholder="sk-ant-..."
              autoFocus
              className="mt-4 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600"
            />
            {keyError && <p className="mt-1 text-xs text-red-400">{keyError}</p>}

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveKey}
                disabled={!keyInput.trim()}
                className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-medium text-black transition-colors hover:bg-amber-300 disabled:opacity-40"
              >
                Save
              </button>
              {anthropicKey && (
                <button
                  onClick={() => { setShowKeyModal(false); setKeyInput(""); setKeyError(""); }}
                  className="flex-1 rounded-xl border border-zinc-800 py-2.5 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
