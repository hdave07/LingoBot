"use client";

import { useEffect, useRef, useState } from "react";
import { getConversations, deleteConversation } from "@/lib/conversation";
import {
  hasTestedForLanguage,
  getCefrForLanguage,
  setCefrForLanguage,
  getLanguageBaseCode,
  getLanguageFullName,
} from "@/lib/onboarding";
import type { ConversationRecord } from "@/lib/conversation";
import type { CefrLevel, TutorLanguage } from "@/lib/onboarding";
import type { PlacementResult } from "@/app/api/placement/route";

type DrawerView =
  | "list"
  | "lang-pick"
  | "placement-record"
  | "placement-result";

interface ConversationHistoryProps {
  open: boolean;
  currentId: string | null;
  currentLanguage: TutorLanguage;
  anthropicKey: string;
  onClose: () => void;
  onLoad: (id: string) => void;
  onNewWithLanguage: (lang: TutorLanguage, cefrLevel: CefrLevel) => void;
}

const LANG_OPTIONS: { lang: TutorLanguage; label: string; sub: string }[] = [
  { lang: "es", label: "Spanish", sub: "Norah or Antonio" },
  { lang: "pt-br", label: "Portuguese — Brazilian", sub: "Scheila" },
  { lang: "pt-pt", label: "Portuguese — European", sub: "Paulo" },
];

const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate",
  B2: "Upper Intermediate", C1: "Advanced", C2: "Near-Native",
};

type RecState = "idle" | "recording" | "analyzing" | "error";
const MAX_SECONDS = 30;

function preferredMime(): string {
  for (const mime of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationHistory({
  open,
  currentId,
  currentLanguage,
  anthropicKey,
  onClose,
  onLoad,
  onNewWithLanguage,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [view, setView] = useState<DrawerView>("list");
  const [selectedLang, setSelectedLang] = useState<TutorLanguage>(currentLanguage);

  // Mini placement
  const [recState, setRecState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recError, setRecError] = useState("");
  const [placementResult, setPlacementResult] = useState<PlacementResult | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setConversations(getConversations());
      setView("list");
    }
  }, [open]);

  // Auto-stop at MAX_SECONDS
  useEffect(() => {
    if (elapsed >= MAX_SECONDS && recState === "recording") {
      stopRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, recState]);

  function resetPlacement() {
    setRecState("idle");
    setElapsed(0);
    setRecError("");
    setPlacementResult(null);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  function handleLangSelect(lang: TutorLanguage) {
    setSelectedLang(lang);
    const base = getLanguageBaseCode(lang);
    if (hasTestedForLanguage(base)) {
      onNewWithLanguage(lang, getCefrForLanguage(base));
      onClose();
    } else {
      resetPlacement();
      setView("placement-record");
    }
  }

  async function startRecording() {
    setRecError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecError("Microphone access denied.");
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
    const fd = new FormData();
    fd.append("file", blob, "recording.webm");
    fd.append("language", getLanguageBaseCode(selectedLang));

    let transcript = "";
    try {
      const sttRes = await fetch("/api/stt", { method: "POST", body: fd });
      if (sttRes.ok) {
        const data = await sttRes.json();
        transcript = (data.transcript as string) ?? "";
      }
    } catch { /* fall through */ }

    try {
      const placRes = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-anthropic-key": anthropicKey },
        body: JSON.stringify({ transcript, tutorLanguage: selectedLang }),
      });
      if (!placRes.ok) throw new Error((await placRes.json().catch(() => ({}))).error ?? "Assessment failed");
      const result: PlacementResult = await placRes.json();
      setPlacementResult(result);
      setView("placement-result");
    } catch (e) {
      setRecError(e instanceof Error ? e.message : "Assessment failed");
      setRecState("error");
    }
  }

  function handleBeginnerSkip() {
    setPlacementResult({ level: "A1", note: "Starting at beginner — adjust anytime via the level badge above." });
    setView("placement-result");
  }

  function handlePlacementConfirm() {
    if (!placementResult) return;
    const base = getLanguageBaseCode(selectedLang);
    setCefrForLanguage(base, placementResult.level);
    onNewWithLanguage(selectedLang, placementResult.level);
    onClose();
  }

  const isRecording = recState === "recording";
  const isAnalyzing = recState === "analyzing";
  const progressPct = (elapsed / MAX_SECONDS) * 100;
  const langFullName = getLanguageFullName(selectedLang);

  const viewTitle: Record<DrawerView, string> = {
    list: "Conversations",
    "lang-pick": "New conversation",
    "placement-record": "Quick placement",
    "placement-result": "Your level",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-zinc-950 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          {view !== "list" ? (
            <button
              onClick={() => {
                resetPlacement();
                setView(view === "lang-pick" ? "list" : "lang-pick");
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
          ) : (
            <h2 className="font-semibold text-white">{viewTitle[view]}</h2>
          )}

          {view !== "list" && (
            <h2 className="font-semibold text-white">{viewTitle[view]}</h2>
          )}

          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── List ── */}
        {view === "list" && (
          <>
            <div className="border-b border-zinc-800 px-5 py-3">
              <button
                onClick={() => setView("lang-pick")}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New conversation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {conversations.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-zinc-600">No past conversations yet</p>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === currentId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => { onLoad(conv.id); onClose(); }}
                      className={`group flex w-full cursor-pointer items-start border-l-2 px-5 py-3 text-left transition-colors hover:bg-zinc-900 ${
                        isActive ? "border-amber-400 bg-zinc-900" : "border-transparent"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`truncate text-sm font-medium ${isActive ? "text-amber-400" : "text-zinc-200"}`}>
                          {conv.title ?? "Untitled conversation"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">
                          {formatDate(conv.savedAt)} · {conv.messages.length} msg
                          {conv.language && (
                            <span className="ml-1.5 rounded px-1 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-500">
                              {conv.language === "es" ? "ES" : conv.language === "pt-br" ? "PT·BR" : "PT·EU"}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="ml-2 mt-0.5 flex-shrink-0 text-zinc-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── Language picker ── */}
        {view === "lang-pick" && (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            <p className="text-sm text-zinc-500">Choose a language to practice</p>
            {LANG_OPTIONS.map((opt) => {
              const base = getLanguageBaseCode(opt.lang);
              const tested = hasTestedForLanguage(base);
              const isCurrent = opt.lang === currentLanguage;
              return (
                <button
                  key={opt.lang}
                  onClick={() => handleLangSelect(opt.lang)}
                  className="flex flex-col rounded-2xl border border-zinc-800 px-4 py-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{opt.label}</span>
                    {isCurrent && <span className="text-xs text-amber-400/70">current</span>}
                    {!isCurrent && !tested && <span className="text-xs text-zinc-600">test needed</span>}
                  </div>
                  <span className="mt-0.5 text-xs text-zinc-500">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Placement: record ── */}
        {view === "placement-record" && (
          <div className="flex flex-1 flex-col items-center gap-5 px-5 py-5">
            <p className="w-full text-sm text-zinc-500">
              Speak in {langFullName} for ~20 seconds — introduce yourself briefly. We&rsquo;ll find your level from that.
            </p>

            {/* Timer bar */}
            <div className="w-full">
              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isRecording ? "bg-red-500" : "bg-zinc-700"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-xs text-zinc-600">{isRecording ? `${elapsed}s` : "0s"}</span>
                <span className="text-xs text-zinc-600">30s</span>
              </div>
            </div>

            {/* Mic button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
              className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 select-none ${
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
              {isRecording ? "Tap to stop" : isAnalyzing ? "Analyzing…" : recState === "error" ? recError : "Tap to start"}
            </p>

            {recState === "error" && (
              <button onClick={() => setRecState("idle")} className="text-sm text-amber-400 hover:text-amber-300">
                Try again
              </button>
            )}

            <button onClick={handleBeginnerSkip} className="text-xs text-zinc-600 hover:text-zinc-400">
              I&rsquo;m a complete beginner — start at A1
            </button>
          </div>
        )}

        {/* ── Placement: result ── */}
        {view === "placement-result" && placementResult && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-6 text-center">
            <div>
              <p className="text-sm text-zinc-500">Placed at</p>
              <p className="mt-1 text-3xl font-bold text-white">{placementResult.level}</p>
              <p className="text-sm text-zinc-400">{LEVEL_LABELS[placementResult.level]}</p>
              <p className="mt-3 text-xs text-zinc-500 leading-relaxed">{placementResult.note}</p>
              <p className="mt-2 text-xs text-zinc-600">Tap the level badge in the bar above to adjust anytime.</p>
            </div>
            <button
              onClick={handlePlacementConfirm}
              className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-medium text-black transition-colors hover:bg-amber-300"
            >
              Start conversation
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 14.9A7.001 7.001 0 0 1 5 9H3a9 9 0 0 0 8 8.94V20H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 9h-2a7 7 0 0 1-5.5 6.9z" />
    </svg>
  );
}

function SmallSpinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
