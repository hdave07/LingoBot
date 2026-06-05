"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboarding } from "@/lib/onboarding";
import { getAnthropicKey } from "@/lib/anthropic-key";
import { VoicePipeline } from "../components/VoicePipeline";
import { ProgressStrip } from "../components/ProgressStrip";
import { ConversationHistory } from "../components/ConversationHistory";
import type { CefrLevel } from "@/lib/onboarding";
import type { VoicePipelineHandle } from "../components/VoicePipeline";

export default function ConversationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("A1");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const pipelineRef = useRef<VoicePipelineHandle>(null);

  useEffect(() => {
    const data = getOnboarding();
    const key = getAnthropicKey();
    if (!data || !key) {
      router.replace("/onboarding");
      return;
    }
    setCefrLevel(data.cefrLevel);
    setAnthropicKey(key);
    setReady(true);
  }, [router]);

  if (!ready) return <div className="min-h-screen bg-black" />;

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-8 pb-2">
        <button
          onClick={() => setHistoryOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-amber-400"
          aria-label="Conversation history"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </button>

        <ProgressStrip cefrLevel={cefrLevel} />

        {/* Spacer for symmetry */}
        <div className="w-8" />
      </div>

      {/* Main */}
      <div className="flex flex-1 items-center justify-center">
        <VoicePipeline
          ref={pipelineRef}
          cefrLevel={cefrLevel}
          anthropicKey={anthropicKey}
        />
      </div>

      {/* History drawer */}
      <ConversationHistory
        open={historyOpen}
        currentId={pipelineRef.current?.getCurrentId() ?? null}
        onClose={() => setHistoryOpen(false)}
        onLoad={(id) => pipelineRef.current?.loadConversationById(id)}
        onNew={() => pipelineRef.current?.startNewConversation()}
      />
    </div>
  );
}
