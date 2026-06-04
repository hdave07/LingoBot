"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { Conversation } from "../components/Conversation";

export default function ConversationPage() {
  return (
    <ConversationProvider>
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Conversation />
      </div>
    </ConversationProvider>
  );
}
