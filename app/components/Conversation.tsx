"use client";

import { useEffect, useRef, useState } from "react";
import {
  useConversationControls,
  useConversationStatus,
  useConversationMode,
} from "@elevenlabs/react";
import { BarVisualizer } from "./BarVisualizer";

interface Message {
  role: "user" | "agent";
  text: string;
}

export function Conversation() {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking, isListening } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggle = () => {
    setError(null);
    if (isConnected) {
      endSession();
    } else {
      setMessages([]);
      startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        onMessage: ({ message, role }) => {
          setMessages((prev) => [...prev, { role, text: message }]);
        },
        onError: (msg) => {
          console.error("[ElevenLabs]", msg);
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        },
        onDisconnect: () => {
          console.log("[ElevenLabs] disconnected");
        },
      });
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
      {/* Transcript */}
      <div className="flex h-64 w-full flex-col overflow-y-auto rounded-2xl bg-zinc-900 p-4">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-zinc-600">
            {isConnected ? "Listening…" : "Conversation will appear here"}
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
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Visualizer */}
      <div
        className={`transition-colors duration-300 ${
          isConnected
            ? isSpeaking
              ? "text-blue-500"
              : "text-green-500"
            : "text-zinc-700"
        }`}
      >
        <BarVisualizer isSpeaking={isSpeaking} isListening={isListening} />
      </div>

      {/* Button + status */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-200 ${
            isConnected
              ? "bg-red-500 hover:bg-red-600"
              : "bg-white text-black hover:bg-zinc-200"
          } disabled:opacity-50`}
        >
          {isConnecting ? <Spinner /> : isConnected ? <StopIcon /> : <MicIcon />}
        </button>

        <span className="text-sm text-zinc-500">
          {isConnecting
            ? "Connecting…"
            : isConnected
            ? isSpeaking
              ? "Speaking"
              : "Listening"
            : "Tap to start"}
        </span>

        {error && (
          <p className="max-w-xs text-center text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 14.9A7.001 7.001 0 0 1 5 9H3a9 9 0 0 0 8 8.94V20H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 9h-2a7 7 0 0 1-5.5 6.9z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
