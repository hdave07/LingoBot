"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboarding } from "@/lib/onboarding";
import { getAnthropicKey } from "@/lib/anthropic-key";
import { VoicePipeline } from "../components/VoicePipeline";
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
    <div className="flex min-h-screen items-center justify-center bg-black">
      <VoicePipeline cefrLevel={cefrLevel} anthropicKey={anthropicKey} />
    </div>
  );
}
