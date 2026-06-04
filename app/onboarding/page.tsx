"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CefrLevel,
  VOCAB_WORDS,
  scoreVocab,
  saveOnboarding,
} from "@/lib/onboarding";
import { saveAnthropicKey } from "@/lib/anthropic-key";

type Step = 1 | 2 | 3 | 4;

const SELF_REPORT_OPTIONS: { label: string; sub: string; level: CefrLevel }[] =
  [
    { label: "I've never studied Spanish", sub: "", level: "A1" },
    {
      label: "I know some basics",
      sub: "simple words and phrases",
      level: "A2",
    },
    {
      label: "I can hold simple conversations",
      sub: "getting by day-to-day",
      level: "B1",
    },
    {
      label: "I'm pretty comfortable",
      sub: "most topics, some gaps",
      level: "B2",
    },
  ];

const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
};

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [initialLevel, setInitialLevel] = useState<CefrLevel>("A1");
  const [wordIndex, setWordIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [finalLevel, setFinalLevel] = useState<CefrLevel>("A1");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState("");

  const handleSelfReport = (level: CefrLevel) => {
    setInitialLevel(level);
    setStep(2);
  };

  const handleVocabAnswer = (knew: boolean) => {
    const next = [...answers, knew];
    setAnswers(next);

    if (wordIndex + 1 < VOCAB_WORDS.length) {
      setWordIndex(wordIndex + 1);
    } else {
      const scored = scoreVocab(next);
      setFinalLevel(scored);
      setStep(3);
    }
  };

  const handleApiKeySubmit = () => {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith("sk-ant-")) {
      setKeyError("Key should start with sk-ant-");
      return;
    }
    saveAnthropicKey(trimmed);
    saveOnboarding({
      initialLevel,
      cefrLevel: finalLevel,
      placementMethod: "vocab_test",
      targetLanguage: "es",
      completedAt: new Date().toISOString(),
      anthropicKeySet: true,
    });
    router.push("/conversation");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        {/* Progress dots */}
        <div className="mb-12 flex justify-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${
                s <= step ? "bg-white" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Self-report */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-zinc-500">Step 1 of 3</p>
              <h1 className="mt-1 text-2xl font-semibold">
                How&rsquo;s your Spanish?
              </h1>
            </div>
            <div className="flex flex-col gap-3">
              {SELF_REPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => handleSelfReport(opt.level)}
                  className="flex flex-col rounded-2xl border border-zinc-800 px-5 py-4 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.sub && (
                    <span className="mt-0.5 text-sm text-zinc-500">
                      {opt.sub}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Vocab pulse check */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-8">
            <div className="w-full">
              <p className="text-sm text-zinc-500">Step 2 of 3</p>
              <h1 className="mt-1 text-2xl font-semibold">Quick vocab check</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Do you know these words?
              </p>
            </div>

            <div className="flex w-full gap-1">
              {VOCAB_WORDS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                    i < wordIndex
                      ? "bg-white"
                      : i === wordIndex
                      ? "bg-zinc-400"
                      : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl font-bold tracking-tight">
                {VOCAB_WORDS[wordIndex].word}
              </span>
              <span className="text-sm text-zinc-600">
                {wordIndex + 1} / {VOCAB_WORDS.length}
              </span>
            </div>

            <div className="flex w-full gap-3">
              <button
                onClick={() => handleVocabAnswer(false)}
                className="flex-1 rounded-2xl border border-zinc-800 py-4 text-center font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
              >
                Don&rsquo;t know
              </button>
              <button
                onClick={() => handleVocabAnswer(true)}
                className="flex-1 rounded-2xl bg-white py-4 text-center font-medium text-black transition-colors hover:bg-zinc-200"
              >
                Know it
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Level result */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-8 text-center">
            <div>
              <p className="text-sm text-zinc-500">Step 3 of 3</p>
              <h1 className="mt-1 text-2xl font-semibold">Your level</h1>
              <p className="mt-3 text-zinc-400">
                Based on your answers:{" "}
                <span className="font-semibold text-white">
                  {finalLevel} — {LEVEL_LABELS[finalLevel]}
                </span>
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                LingoBot will adjust as you practice.
              </p>
            </div>
            <button
              onClick={() => setStep(4)}
              className="w-full rounded-2xl bg-white py-4 font-medium text-black transition-colors hover:bg-zinc-200"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 4 — Anthropic API key */}
        {step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm text-zinc-500">Almost there</p>
              <h1 className="mt-1 text-2xl font-semibold">
                Your Claude API key
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                LingoBot runs on Claude. Your key stays on your device and is
                only used to make API calls on your behalf.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex overflow-hidden rounded-2xl border border-zinc-800 focus-within:border-zinc-500">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeyError("");
                  }}
                  placeholder="sk-ant-…"
                  className="flex-1 bg-transparent px-4 py-4 text-sm text-white placeholder-zinc-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="px-4 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              {keyError && (
                <p className="text-xs text-red-500">{keyError}</p>
              )}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-600 hover:text-zinc-400"
              >
                Get a key at console.anthropic.com →
              </a>
            </div>

            <button
              onClick={handleApiKeySubmit}
              disabled={!apiKey.trim()}
              className="w-full rounded-2xl bg-white py-4 font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
            >
              Start learning
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
