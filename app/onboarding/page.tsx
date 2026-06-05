"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CefrLevel,
  TutorLanguage,
  getLanguageName,
  getLanguageFullName,
  getLanguageBaseCode,
  saveOnboarding,
  setActiveLanguage,
  setCefrForLanguage,
  setTutorVoice,
  getDefaultVoiceForLanguage,
} from "@/lib/onboarding";
import type { PlacementResult } from "@/app/api/placement/route";

// DEMO: API key comes from server env (ANTHROPIC_API_KEY).
// To restore BYOK: add step 2 back to collect the key, import saveAnthropicKey,
// and change processAudio to send the stored key in x-anthropic-key header.

type Step = 1 | 2 | 3;
type RecState = "idle" | "recording" | "analyzing" | "error";

const LANGUAGE_OPTIONS: { lang: TutorLanguage; label: string; sub: string }[] = [
  { lang: "es", label: "Spanish", sub: "Latin American — Norah or Antonio" },
  { lang: "pt-br", label: "Portuguese — Brazilian", sub: "Brasil — Scheila" },
  { lang: "pt-pt", label: "Portuguese — European", sub: "Portugal — Paulo" },
];

const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate",
  B2: "Upper Intermediate", C1: "Advanced", C2: "Near-Native",
};

function preferredMime(): string {
  for (const mime of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [tutorLanguage, setTutorLanguage] = useState<TutorLanguage>("es");

  // Speaking test state
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recError, setRecError] = useState("");
  const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_SECONDS = 30;

  // Reset recording state when entering the speaking step
  useEffect(() => {
    if (step === 2) {
      setRecState("idle");
      setElapsed(0);
      setRecError("");
      setPlacementResult(null);
    }
  }, [step]);

  // Auto-stop at MAX_SECONDS
  useEffect(() => {
    if (elapsed >= MAX_SECONDS && recState === "recording") {
      stopRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recState]);

  function handleLanguageSelect(lang: TutorLanguage) {
    setTutorLanguage(lang);
    setStep(2);
  }

  async function startRecording() {
    setRecError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecError("Microphone access denied — please allow mic access and try again.");
      return;
    }

    chunksRef.current = [];
    const mime = preferredMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(100);
    mrRef.current = mr;

    setElapsed(0);
    setRecState("recording");
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const mr = mrRef.current;
    if (!mr || mr.state === "inactive") return;

    mr.stream.getTracks().forEach((t) => t.stop());
    mr.stop();

    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); });

    const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
    await processAudio(blob);
  }

  async function processAudio(blob: Blob) {
    setRecState("analyzing");

    // 1 — STT
    const fd = new FormData();
    fd.append("file", blob, "recording.webm");
    fd.append("language", tutorLanguage === "es" ? "es" : "pt");

    let transcript = "";
    try {
      const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
      if (sttRes.ok) {
        const data = await sttRes.json();
        transcript = (data.transcript as string) ?? "";
      }
    } catch { /* fall through with empty transcript */ }

    // 2 — Placement (server uses ANTHROPIC_API_KEY env var)
    try {
      const placRes = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, tutorLanguage }),
      });

      if (!placRes.ok) {
        const e = await placRes.json().catch(() => ({}));
        throw new Error(e.error ?? placRes.statusText);
      }

      const result: PlacementResult = await placRes.json();
      setPlacementResult(result);
      setStep(3);
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Assessment failed — please try again.");
      setRecState("error");
    }
  }

  function handleBeginnerSkip() {
    setPlacementResult({ level: "A1", note: "You'll start at beginner level — the bar above lets you adjust anytime." });
    setStep(3);
  }

  function handleFinish() {
    if (!placementResult) return;
    const baseLanguage = getLanguageBaseCode(tutorLanguage);
    const ptDialect = tutorLanguage === "pt-br" ? "br" : tutorLanguage === "pt-pt" ? "pt-pt" : undefined;

    saveOnboarding({
      initialLevel: placementResult.level,
      cefrLevel: placementResult.level,
      placementMethod: "speaking_test",
      targetLanguage: baseLanguage,
      ptDialect,
      completedAt: new Date().toISOString(),
      anthropicKeySet: true,
    });

    setActiveLanguage(tutorLanguage);
    setCefrForLanguage(baseLanguage, placementResult.level);
    setTutorVoice(getDefaultVoiceForLanguage(tutorLanguage));

    router.push("/conversation");
  }

  const langName = getLanguageName(tutorLanguage);
  const langFullName = getLanguageFullName(tutorLanguage);
  const progressPct = (elapsed / MAX_SECONDS) * 100;
  const isRecording = recState === "recording";
  const isAnalyzing = recState === "analyzing";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <p className="mb-10 text-center text-sm font-bold tracking-[0.2em] text-white uppercase">
          TalkMore
        </p>

        {/* Progress dots */}
        <div className="mb-12 flex justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${
                s <= step ? "bg-white" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Language ── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-zinc-500">Getting started</p>
              <h1 className="mt-1 text-2xl font-semibold">What would you like to learn?</h1>
            </div>
            <div className="flex flex-col gap-3">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.lang}
                  onClick={() => handleLanguageSelect(opt.lang)}
                  className="flex flex-col rounded-2xl border border-zinc-800 px-5 py-4 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="mt-0.5 text-sm text-zinc-500">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Speaking test ── */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-8">
            <div className="w-full">
              <p className="text-sm text-zinc-500">Step 1 of 2</p>
              <h1 className="mt-1 text-2xl font-semibold">Let&rsquo;s hear your {langName}</h1>
              <p className="mt-2 text-sm text-zinc-500">
                Speak for about 20–30 seconds in {langFullName}.
                Tell us a little about yourself — your name, where you&rsquo;re from, what you like to do.
                We&rsquo;ll find your level from that.
              </p>
            </div>

            {/* Timer bar */}
            <div className="w-full">
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    isRecording ? "bg-red-500" : "bg-zinc-700"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-xs text-zinc-600">
                  {isRecording ? `${elapsed}s` : "0s"}
                </span>
                <span className="text-xs text-zinc-600">30s</span>
              </div>
            </div>

            {/* Mic button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 select-none ${
                isRecording
                  ? "scale-110 bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : isAnalyzing
                  ? "bg-zinc-800 text-zinc-500"
                  : "bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20"
              }`}
            >
              {isAnalyzing ? <SmallSpinner /> : <MicIcon />}
            </button>

            <p className="text-sm text-zinc-500">
              {isRecording
                ? "Tap to stop early"
                : isAnalyzing
                ? "Analyzing your level…"
                : recState === "error"
                ? recError
                : "Tap to start recording"}
            </p>

            {recError && recState === "error" && (
              <button
                onClick={() => setRecState("idle")}
                className="text-sm text-amber-400 hover:text-amber-300"
              >
                Try again
              </button>
            )}

            <button
              onClick={handleBeginnerSkip}
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              I&rsquo;m a complete beginner — skip to A1
            </button>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === 3 && placementResult && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="w-full">
              <p className="text-sm text-zinc-500">Step 2 of 2</p>
              <h1 className="mt-1 text-2xl font-semibold">Your level</h1>
              <div className="mt-4 flex flex-col items-center gap-2">
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-4 py-1 text-lg font-bold text-amber-400">
                  {placementResult.level}
                </span>
                <p className="text-base font-medium text-white">
                  {LEVEL_LABELS[placementResult.level]}
                </p>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{placementResult.note}</p>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3.5 text-left">
                <span className="mt-0.5 text-base leading-none text-amber-400">↑</span>
                <p className="text-sm leading-snug text-zinc-300">
                  Jump in and have a conversation. If it feels too easy or too hard,
                  tap the level badge in the top bar to adjust it anytime.
                </p>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full rounded-2xl bg-amber-400 py-4 font-medium text-black transition-colors hover:bg-amber-300"
            >
              Start learning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 14.9A7.001 7.001 0 0 1 5 9H3a9 9 0 0 0 8 8.94V20H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 9h-2a7 7 0 0 1-5.5 6.9z" />
    </svg>
  );
}

function SmallSpinner() {
  return (
    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
