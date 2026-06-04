"use client";

import { useEffect, useRef, useState } from "react";
import { BarVisualizer } from "./BarVisualizer";
import type { CefrLevel } from "@/lib/onboarding";

type PipelineState =
  | "idle"
  | "recording"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

interface Message {
  role: "user" | "agent";
  text: string;
}

interface VoicePipelineProps {
  cefrLevel: CefrLevel;
  anthropicKey: string;
}

function preferredMime(): string {
  for (const mime of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return "";
}

export function VoicePipeline({ cefrLevel, anthropicKey }: VoicePipelineProps) {
  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const [transcript, setTranscript] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, assistantText]);

  function handleError(msg: string) {
    console.error("[VoicePipeline]", msg);
    setError(msg);
    setPipelineState("error");
    setInputAnalyser(null);
    setOutputAnalyser(null);
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

    // Create AudioContext here (direct user gesture — required for iOS)
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    setInputAnalyser(analyser);

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
    setInputAnalyser(null);

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
    });

    const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
    await runPipeline(blob);
  }

  async function runPipeline(audioBlob: Blob) {
    // --- STT ---
    setPipelineState("transcribing");
    const fd = new FormData();
    fd.append("audio", audioBlob, "recording.webm");
    fd.append("language", "es");

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

    // --- Claude streaming ---
    setPipelineState("thinking");
    setAssistantText("");

    const history = updatedMessages.slice(-10).map((m) => ({
      role: m.role === "user" ? "user" : ("assistant" as "user" | "assistant"),
      content: m.text,
    }));
    // Remove the last user message from history — it's sent as transcript
    const historyWithoutLast = history.slice(0, -1);

    let fullText = "";
    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-anthropic-key": anthropicKey,
        },
        body: JSON.stringify({
          transcript: userTranscript,
          cefrLevel,
          history: historyWithoutLast,
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
            if (msg.type === "delta") {
              fullText += msg.text;
              setAssistantText(fullText);
            } else if (msg.type === "done") {
              fullText = msg.fullText;
            } else if (msg.type === "error") {
              handleError(msg.error);
              return;
            }
          } catch {
            // partial JSON line, skip
          }
        }
      }
    } catch (e) {
      handleError(`Chat error: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    setMessages((prev) => [...prev, { role: "agent", text: fullText }]);
    setAssistantText("");

    // --- TTS ---
    setPipelineState("speaking");
    await playTTS(fullText);

    setPipelineState("idle");
  }

  async function playTTS(text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: res.statusText }));
        handleError(`TTS failed: ${e.error ?? res.statusText}`);
        return;
      }

      const arrayBuffer = await res.arrayBuffer();

      // Reuse AudioContext created during press start; resume in case it suspended
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      setOutputAnalyser(analyser);

      await new Promise<void>((resolve) => {
        source.onended = () => {
          setOutputAnalyser(null);
          resolve();
        };
        source.start();
      });
    } catch (e) {
      handleError(`Playback error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const isActive = pipelineState !== "idle" && pipelineState !== "error";
  const isRecording = pipelineState === "recording";

  const statusLabel: Record<PipelineState, string> = {
    idle: "Hold to speak",
    recording: "Recording…",
    transcribing: "Understanding…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    error: error ?? "Error",
  };

  const vizColor: Record<PipelineState, string> = {
    idle: "text-zinc-700",
    recording: "text-green-500",
    transcribing: "text-zinc-500",
    thinking: "text-zinc-500",
    speaking: "text-blue-500",
    error: "text-red-500",
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
      {/* Transcript */}
      <div className="flex h-64 w-full flex-col overflow-y-auto rounded-2xl bg-zinc-900 p-4">
        {messages.length === 0 && !assistantText ? (
          <p className="m-auto text-sm text-zinc-600">
            {isActive ? statusLabel[pipelineState] : "Hold the button and speak in Spanish"}
          </p>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-800 text-zinc-100"
                  }`}
                >
                  {msg.text}
                </span>
              </div>
            ))}
            {pipelineState === "thinking" && assistantText && (
              <div className="mb-2 flex justify-start">
                <span className="max-w-[85%] rounded-2xl bg-zinc-800 px-3 py-2 text-sm leading-relaxed text-zinc-300">
                  {assistantText}
                  <span className="animate-pulse">▌</span>
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Visualizer */}
      <div className={`transition-colors duration-300 ${vizColor[pipelineState]}`}>
        <BarVisualizer
          analyser={isRecording ? inputAnalyser : outputAnalyser}
        />
      </div>

      {/* Button + status */}
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
              : "bg-white text-black hover:bg-zinc-200"
          } disabled:cursor-not-allowed`}
        >
          {isActive && !isRecording ? <Spinner /> : <MicIcon />}
        </button>

        <span className="text-sm text-zinc-500">{statusLabel[pipelineState]}</span>

        {error && (
          <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Show last user transcript below when in non-idle state */}
      {transcript && isActive && (
        <p className="text-center text-xs text-zinc-600">&ldquo;{transcript}&rdquo;</p>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 14.9A7.001 7.001 0 0 1 5 9H3a9 9 0 0 0 8 8.94V20H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 9h-2a7 7 0 0 1-5.5 6.9z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
