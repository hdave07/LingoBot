export interface SavedMessage {
  role: "user" | "agent";
  text: string;
  vocab?: Array<{ word: string; translation: string }>;
  tip?: string | null;
}

export interface SavedConversation {
  messages: SavedMessage[];
  title: string | null;
  savedAt: string;
}

const KEY = "lingobot_conversation";

export function saveConversation(data: SavedConversation): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

export function loadConversation(): SavedConversation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedConversation) : null;
  } catch {
    return null;
  }
}

export function clearConversation(): void {
  localStorage.removeItem(KEY);
}
