"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DogMascot } from "./DogMascot";
import { VocabText } from "./VocabText";
import { SessionSummary } from "./SessionSummary";
import {
  getShowTips,
  setShowTips,
  getTutorVoice,
  setTutorVoice,
  VOICE_IDS,
  VOICE_NAMES,
  getActiveLanguage,
  setActiveLanguage,
  getCefrForLanguage,
  getDefaultVoiceForLanguage,
  getNextVoiceForLanguage,
  getSttLanguageCode,
  getLanguageBaseCode,
} from "@/lib/onboarding";
import { recordSessionStart, recordExchange } from "@/lib/progress";
import {
  saveConversation,
  getConversation,
  getCurrentConversationId,
  setCurrentConversationId,
  createConversationId,
} from "@/lib/conversation";
import type { CefrLevel, TutorLanguage, TutorVoice } from "@/lib/onboarding";
import type { SummaryData } from "@/app/api/summary/route";

type PipelineState =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

interface VocabEntry {
  word: string;
  translation: string;
}

interface Message {
  role: "user" | "agent";
  text: string;
  vocab?: VocabEntry[];
  tip?: string | null;
}

interface VoicePipelineProps {
  cefrLevel: CefrLevel;
  anthropicKey: string;
  onLanguageChange?: (lang: TutorLanguage, cefrLevel: CefrLevel) => void;
}

export interface VoicePipelineHandle {
  loadConversationById: (id: string) => void;
  startNewConversation: () => void;
  startNewConversationWithLanguage: (lang: TutorLanguage, cefrLevel: CefrLevel) => void;
  getCurrentId: () => string | null;
  getCurrentLanguage: () => TutorLanguage;
}

function friendlyError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("empty") || r.includes("corrupted") || r.includes("no audio") || r.includes("empty_file")) {
    return "¿Puedes repetir? I didn't catch that — try holding a little longer.";
  }
  if (r.includes("microphone") || r.includes("permission") || r.includes("denied")) {
    return "Microphone access denied — please allow mic access and try again.";
  }
  if (r.includes("transcri") || r.includes("stt")) {
    return "Couldn't understand the audio — please try again.";
  }
  if (r.includes("claude") || r.includes("anthropic") || r.includes("api key")) {
    return "Couldn't reach the AI — check your API key and try again.";
  }
  return "Something went wrong — please try again.";
}

const IDLE_PROMPTS = [
  "Try: tell me about your day",
  "Try: describe where you live",
  "Try: what do you enjoy doing?",
  "Try: talk about your work or studies",
];

function preferredMime(): string {
  for (const mime of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export const VoicePipeline = forwardRef<VoicePipelineHandle, VoicePipelineProps>(
  function VoicePipeline({ cefrLevel: cefrLevelProp, anthropicKey, onLanguageChange }, ref) {
    const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
    const [transcript, setTranscript] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showTips, setShowTipsState] = useState(true);
    const [voice, setVoiceState] = useState<TutorVoice>("norah");
    const [tutorLanguage, setTutorLanguageState] = useState<TutorLanguage>("es");
    const [activeCefrLevel, setActiveCefrLevel] = useState<CefrLevel>(cefrLevelProp);
    const [conversationTitle, setConversationTitle] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [promptIdx, setPromptIdx] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const pressStartRef = useRef<() => Promise<void>>(async () => {});
    const pressEndRef = useRef<() => Promise<void>>(async () => {});

    // Sync when parent updates cefrLevel (e.g. ProgressStrip level change)
    const prevCefrPropRef = useRef(cefrLevelProp);
    useEffect(() => {
      if (cefrLevelProp !== prevCefrPropRef.current) {
        prevCefrPropRef.current = cefrLevelProp;
        setActiveCefrLevel(cefrLevelProp);
      }
    }, [cefrLevelProp]);

    useImperativeHandle(ref, () => ({
      loadConversationById(id: string) {
        const conv = getConversation(id);
        if (!conv) return;
        setMessages(conv.messages);
        setConversationTitle(conv.title);
        setConversationId(id);
        setCurrentConversationId(id);
        setSummaryData(null);
        setError(null);
        setPipelineState("idle");

        // Restore the language and voice the conversation was recorded in
        if (conv.language) {
          const lang = conv.language as TutorLanguage;
          const base = getLanguageBaseCode(lang);
          const restoredVoice = getDefaultVoiceForLanguage(lang);
          setActiveLanguage(lang);
          setTutorVoice(restoredVoice);
          setTutorLanguageState(lang);
          setVoiceState(restoredVoice);
          setActiveCefrLevel(getCefrForLanguage(base));
          onLanguageChange?.(lang, getCefrForLanguage(base));
        }
      },
      startNewConversation() {
        setMessages([]);
        setConversationTitle(null);
        setConversationId(null);
        setSummaryData(null);
        setError(null);
        setPipelineState("idle");
      },
      startNewConversationWithLanguage(lang: TutorLanguage, cefrLevel: CefrLevel) {
        const nextVoice = getDefaultVoiceForLanguage(lang);
        setActiveLanguage(lang);
        setTutorVoice(nextVoice);
        setTutorLanguageState(lang);
        setVoiceState(nextVoice);
        setActiveCefrLevel(cefrLevel);
        setMessages([]);
        setConversationTitle(null);
        setConversationId(null);
        setSummaryData(null);
        setError(null);
        setPipelineState("idle");
        onLanguageChange?.(lang, cefrLevel);
      },
      getCurrentId() {
        return conversationId;
      },
      getCurrentLanguage() {
        return tutorLanguage;
      },
    }));

    useEffect(() => {
      setShowTipsState(getShowTips());
      const lang = getActiveLanguage();
      setTutorLanguageState(lang);
      const savedVoice = getTutorVoice();
      setVoiceState(savedVoice);
      setActiveCefrLevel(getCefrForLanguage(getLanguageBaseCode(lang)) ?? cefrLevelProp);

      const currentId = getCurrentConversationId();
      if (currentId) {
        const saved = getConversation(currentId);
        if (saved) {
          setMessages(saved.messages);
          setConversationTitle(saved.title);
          setConversationId(currentId);
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Rotate idle prompt suggestions
    useEffect(() => {
      if (messages.length > 0 || pipelineState !== "idle") return;
      const t = setInterval(() => setPromptIdx((i) => (i + 1) % IDLE_PROMPTS.length), 4000);
      return () => clearInterval(t);
    }, [messages.length, pipelineState]);

    // Space bar = hold to record on desktop
    useEffect(() => {
      const onDown = (e: KeyboardEvent) => {
        if (e.code !== "Space" || e.repeat) return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        e.preventDefault();
        pressStartRef.current();
      };
      const onUp = (e: KeyboardEvent) => {
        if (e.code !== "Space") return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
        e.preventDefault();
        pressEndRef.current();
      };
      window.addEventListener("keydown", onDown);
      window.addEventListener("keyup", onUp);
      return () => {
        window.removeEventListener("keydown", onDown);
        window.removeEventListener("keyup", onUp);
      };
    }, []);

    function handleTipToggle() {
      const next = !showTips;
      setShowTips(next);
      setShowTipsState(next);
    }

    function handleVoiceToggle() {
      const next = getNextVoiceForLanguage(voice, tutorLanguage);
      setTutorVoice(next);
      setVoiceState(next);

      // For Portuguese, switching voice also switches the dialect — but does NOT clear the session
      if (tutorLanguage !== "es") {
        const nextLang: TutorLanguage = next === "scheila" ? "pt-br" : "pt-pt";
        setActiveLanguage(nextLang);
        setTutorLanguageState(nextLang);
      }
    }

    function handleError(msg: string) {
      console.error("[VoicePipeline]", msg);
      setError(friendlyError(msg));
      setPipelineState("error");
    }

    async function handlePressStart() {
      if (pipelineState !== "idle" && pipelineState !== "error") return;
      setError(null);
      setPipelineState("recording");

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        handleError("Microphone access denied");
        return;
      }

      audioCtxRef.current = new AudioContext();

      chunksRef.current = [];
      const mime = preferredMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
    }

    async function handlePressEnd() {
      if (pipelineState !== "recording") return;
      const mr = mediaRecorderRef.current;
      if (!mr) return;

      mr.stream.getTracks().forEach((t) => t.stop());
      mr.stop();

      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
      });

      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      await runPipeline(blob);
    }

    async function runPipeline(audioBlob: Blob) {
      let currentId = conversationId;
      if (messages.length === 0) {
        recordSessionStart();
        currentId = createConversationId();
        setConversationId(currentId);
        setCurrentConversationId(currentId);
      }

      // --- STT ---
      setPipelineState("transcribing");
      const fd = new FormData();
      fd.append("file", audioBlob, "recording.webm");
      fd.append("language", getSttLanguageCode(tutorLanguage));

      let userTranscript = "";
      try {
        const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
        if (!sttRes.ok) {
          const e = await sttRes.json().catch(() => ({ error: sttRes.statusText }));
          handleError(`Transcription failed: ${e.error ?? sttRes.statusText}`);
          return;
        }
        const sttData = await sttRes.json();
        userTranscript = sttData.transcript ?? "";
      } catch (e) {
        handleError(`Transcription error: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }

      setTranscript(userTranscript);
      const updatedMessages: Message[] = [
        ...messages,
        { role: "user", text: userTranscript },
      ];
      setMessages(updatedMessages);

      const userCount = updatedMessages.filter((m) => m.role === "user").length;
      const shouldGenerateTitle = userCount === 2 && !conversationTitle;

      // --- Claude ---
      setPipelineState("thinking");

      const history = updatedMessages.slice(-10).map((m) => ({
        role: m.role === "user" ? "user" : ("assistant" as "user" | "assistant"),
        content: m.text,
      }));
      const historyWithoutLast = history.slice(0, -1);

      let agentText = "";
      let agentVocab: VocabEntry[] = [];
      let agentTip: string | null = null;
      let generatedTitle: string | null = null;

      try {
        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anthropic-key": anthropicKey,
          },
          body: JSON.stringify({
            transcript: userTranscript,
            cefrLevel: activeCefrLevel,
            history: historyWithoutLast,
            showTips,
            generateTitle: shouldGenerateTitle,
            tutorName: VOICE_NAMES[voice],
            tutorLanguage,
          }),
        });

        if (!chatRes.ok) {
          const e = await chatRes.json().catch(() => ({ error: chatRes.statusText }));
          handleError(`Claude error: ${e.error ?? chatRes.statusText}`);
          return;
        }

        const reader = chatRes.body!.getReader();
        const dec = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "done") {
                agentText = msg.text ?? "";
                agentVocab = msg.vocab ?? [];
                agentTip = msg.tip ?? null;
                generatedTitle = msg.title ?? null;
              } else if (msg.type === "error") {
                handleError(msg.error);
                return;
              }
            } catch {
              // partial line, skip
            }
          }
        }
      } catch (e) {
        handleError(`Chat error: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }

      const newTitle = generatedTitle ?? conversationTitle;
      if (generatedTitle) setConversationTitle(generatedTitle);

      const nextMessages: Message[] = [
        ...updatedMessages,
        { role: "agent", text: agentText, vocab: agentVocab, tip: agentTip },
      ];
      setMessages(nextMessages);

      if (currentId) {
        saveConversation({
          id: currentId,
          title: newTitle,
          messages: nextMessages,
          cefrLevel: activeCefrLevel,
          language: tutorLanguage,
          savedAt: new Date().toISOString(),
        });
      }

      // --- TTS ---
      setPipelineState("speaking");
      await playTTS(agentText);

      recordExchange();
      setPipelineState("idle");
    }

    async function playTTS(text: string) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceId: VOICE_IDS[voice] }),
        });

        if (!res.ok) {
          const e = await res.json().catch(() => ({ error: res.statusText }));
          handleError(`TTS failed: ${e.error ?? res.statusText}`);
          return;
        }

        const arrayBuffer = await res.arrayBuffer();

        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.resume();

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } catch (e) {
        handleError(`Playback error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    async function handleEndSession() {
      setSummaryLoading(true);
      try {
        const res = await fetch("/api/summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-anthropic-key": anthropicKey,
          },
          body: JSON.stringify({ messages, cefrLevel: activeCefrLevel, tutorLanguage }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSummaryData(data.summary);
      } catch (e) {
        handleError(`Summary error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSummaryLoading(false);
      }
    }

    // Keep refs pointing at latest functions for the spacebar listener
    pressStartRef.current = handlePressStart;
    pressEndRef.current = handlePressEnd;

    const isActive = pipelineState !== "idle" && pipelineState !== "error";
    const isRecording = pipelineState === "recording";
    const agentMessageCount = messages.filter((m) => m.role === "agent").length;
    const showEndSession = agentMessageCount >= 2 && pipelineState === "idle";

    const idlePlaceholder = `Hold the button and speak in ${
      tutorLanguage === "es" ? "Spanish" : "Portuguese"
    }`;

    const statusLabel: Record<PipelineState, string> = {
      idle: "Hold to speak",
      recording: "Recording…",
      transcribing: "Understanding…",
      thinking: "Thinking…",
      speaking: "Speaking…",
      error: "Tap to try again",
    };

    // Voice toggle label shows both options so it's clear what tapping does
    const voiceToggleLabel = tutorLanguage === "es"
      ? (voice === "norah" ? "Norah" : "Antonio")
      : (voice === "scheila" ? "Scheila" : "Paulo");

    return (
      <>
        {summaryData && (
          <SessionSummary
            summary={summaryData}
            onContinue={() => setSummaryData(null)}
            onNewConversation={() => {
              setSummaryData(null);
              setMessages([]);
              setConversationTitle(null);
              setConversationId(null);
              setPipelineState("idle");
            }}
          />
        )}

        <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
          {/* Title + chat box grouped so the title sits tight above the box */}
          <div className="flex w-full flex-col gap-1.5">
            {conversationTitle && (
              <p className="w-full truncate text-sm font-medium text-amber-400">
                {conversationTitle}
              </p>
            )}

            <div className="flex h-80 w-full flex-col overflow-y-auto rounded-2xl border border-zinc-800/60 bg-zinc-900 p-4">
            {messages.length === 0 ? (
              <div className="m-auto flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-zinc-600">
                  {isActive ? statusLabel[pipelineState] : idlePlaceholder}
                </p>
                {!isActive && (
                  <p className="text-xs text-zinc-700">{IDLE_PROMPTS[promptIdx]}</p>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-2 flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <span
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-zinc-700 text-white"
                          : "bg-zinc-800 text-zinc-100"
                      }`}
                    >
                      {msg.role === "agent" && msg.vocab?.length ? (
                        <VocabText text={msg.text} vocab={msg.vocab} />
                      ) : (
                        msg.text
                      )}
                    </span>
                    {msg.role === "agent" && msg.tip && (
                      <p className="mt-1 max-w-[85%] px-1 text-xs text-amber-500/70">
                        {msg.tip}
                      </p>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
            </div>
          </div>

          {/* Dog mascot */}
          <DogMascot pipelineState={summaryLoading ? "thinking" : pipelineState} />

          {/* Mic button + status */}
          <div className="flex flex-col items-center gap-3">
            <button
              onMouseDown={handlePressStart}
              onMouseUp={handlePressEnd}
              onMouseLeave={() => { if (isRecording) handlePressEnd(); }}
              onTouchStart={(e) => { e.preventDefault(); handlePressStart(); }}
              onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
              disabled={isActive && !isRecording}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 select-none ${
                isRecording
                  ? "scale-110 bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : isActive
                  ? "bg-zinc-800 text-zinc-500"
                  : "bg-amber-400 text-black hover:bg-amber-300 shadow-lg shadow-amber-400/20"
              } disabled:cursor-not-allowed`}
            >
              {isActive && !isRecording ? <Spinner /> : <MicIcon />}
            </button>

            <span className={`text-sm ${pipelineState === "error" ? "text-red-500" : "text-zinc-500"}`}>
              {statusLabel[pipelineState]}
            </span>

            {error && (
              <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
            )}

            {/* Toggles */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleTipToggle}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  showTips
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400"
                }`}
              >
                💡 {showTips ? "Tips on" : "Tips off"}
              </button>

              <button
                onClick={handleVoiceToggle}
                className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition-colors hover:border-amber-500/30 hover:text-amber-400"
              >
                🎙️ {voiceToggleLabel}
              </button>
            </div>

            {/* Language indicator */}
            <p className="text-xs text-zinc-600">
              {tutorLanguage === "es" ? "Español" : tutorLanguage === "pt-br" ? "Português (BR)" : "Português (EU)"}
            </p>

            {/* End session */}
            {showEndSession && (
              <button
                onClick={handleEndSession}
                disabled={summaryLoading}
                className="mt-1 flex items-center gap-2 rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
              >
                {summaryLoading ? (
                  <>
                    <Spinner16 /> Generating summary…
                  </>
                ) : (
                  "End session →"
                )}
              </button>
            )}
          </div>

          {transcript && isActive && (
            <p className="text-center text-xs text-zinc-600">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>
      </>
    );
  }
);

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 14.9A7.001 7.001 0 0 1 5 9H3a9 9 0 0 0 8 8.94V20H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 9h-2a7 7 0 0 1-5.5 6.9z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function Spinner16() {
  return (
    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
