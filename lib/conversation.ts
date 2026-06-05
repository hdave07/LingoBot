export interface SavedMessage {
  role: "user" | "agent";
  text: string;
  vocab?: Array<{ word: string; translation: string }>;
  tip?: string | null;
}

export interface ConversationRecord {
  id: string;
  title: string | null;
  messages: SavedMessage[];
  cefrLevel: string;
  savedAt: string;
}

const CONVERSATIONS_KEY = "lingobot_conversations";
const CURRENT_ID_KEY = "lingobot_current_conversation_id";

export function createConversationId(): string {
  return Date.now().toString();
}

export function getConversations(): ConversationRecord[] {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    const all: ConversationRecord[] = raw ? JSON.parse(raw) : [];
    return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export function getConversation(id: string): ConversationRecord | null {
  return getConversations().find((c) => c.id === id) ?? null;
}

export function saveConversation(record: ConversationRecord): void {
  try {
    const all = getConversations();
    const idx = all.findIndex((c) => c.id === record.id);
    if (idx >= 0) {
      all[idx] = record;
    } else {
      all.push(record);
    }
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
  } catch { /* storage full */ }
}

export function deleteConversation(id: string): void {
  try {
    const all = getConversations().filter((c) => c.id !== id);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
    if (getCurrentConversationId() === id) {
      localStorage.removeItem(CURRENT_ID_KEY);
    }
  } catch { /* ignore */ }
}

export function getCurrentConversationId(): string | null {
  try {
    return localStorage.getItem(CURRENT_ID_KEY);
  } catch {
    return null;
  }
}

export function setCurrentConversationId(id: string): void {
  try {
    localStorage.setItem(CURRENT_ID_KEY, id);
  } catch { /* ignore */ }
}
