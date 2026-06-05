export const siteConfig = {
  name: "LingoBot",
  title: "LingoBot — Foreign Language Conversation Partner",
  description:
    "Practice a foreign language with a voice-first AI tutor. Speak naturally, get CEFR-adapted responses, and pick up grammar tips along the way.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
