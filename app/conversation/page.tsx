"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboarding } from "@/lib/onboarding";
import { getAnthropicKey } from "@/lib/anthropic-key";
import { VoicePipeline } from "../components/VoicePipeline";
import { ProgressStrip } from "../components/ProgressStrip";
import type { CefrLevel } from "@/lib/onboarding";

export default function ConversationPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("A1");
  const [anthropicKey, setAnthropicKey] = useState("");

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
      <div className="flex justify-center pt-8 pb-2">
        <ProgressStrip cefrLevel={cefrLevel} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <VoicePipeline cefrLevel={cefrLevel} anthropicKey={anthropicKey} />
      </div>
    </div>
  );
}
