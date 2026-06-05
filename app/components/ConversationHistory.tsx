"use client";

import { useEffect, useState } from "react";
import { getConversations, deleteConversation } from "@/lib/conversation";
import type { ConversationRecord } from "@/lib/conversation";

interface ConversationHistoryProps {
  open: boolean;
  currentId: string | null;
  onClose: () => void;
  onLoad: (id: string) => void;
  onNew: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationHistory({
  open,
  currentId,
  onClose,
  onLoad,
  onNew,
}: ConversationHistoryProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);

  useEffect(() => {
    if (open) setConversations(getConversations());
  }, [open]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="font-semibold text-white">Conversations</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New conversation */}
        <div className="border-b border-zinc-800 px-5 py-3">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New conversation
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-zinc-600">
              No past conversations yet
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === currentId;
              const msgCount = conv.messages.length;
              return (
                <div
                  key={conv.id}
                  onClick={() => { onLoad(conv.id); onClose(); }}
                  className={`group flex w-full cursor-pointer items-start gap-0 border-l-2 px-5 py-3 text-left transition-colors hover:bg-zinc-900 ${
                    isActive
                      ? "border-amber-400 bg-zinc-900"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`truncate text-sm font-medium ${isActive ? "text-amber-400" : "text-zinc-200"}`}>
                      {conv.title ?? "Untitled conversation"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      {formatDate(conv.savedAt)} · {msgCount} message{msgCount !== 1 ? "s" : ""}
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
      </div>
    </>
  );
}
