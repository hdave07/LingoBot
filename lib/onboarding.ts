export type CefrLevel = "A1" | "A2" | "B1" | "B2";
export type PlacementMethod = "self_report" | "vocab_test";

export interface OnboardingData {
  initialLevel: CefrLevel;
  cefrLevel: CefrLevel;
  placementMethod: PlacementMethod;
  targetLanguage: "es";
  completedAt: string;
}

export interface VocabWord {
  word: string;
  translation: string;
  level: CefrLevel;
}

export const VOCAB_WORDS: VocabWord[] = [
  { word: "hola", translation: "hello", level: "A1" },
  { word: "agua", translation: "water", level: "A1" },
  { word: "comer", translation: "to eat", level: "A1" },
  { word: "ciudad", translation: "city", level: "A2" },
  { word: "trabajo", translation: "work / job", level: "A2" },
  { word: "siempre", translation: "always", level: "A2" },
  { word: "aunque", translation: "although / even though", level: "B1" },
  { word: "lograr", translation: "to achieve", level: "B1" },
  { word: "madrugada", translation: "early morning / dawn", level: "B2" },
  { word: "cotidiano", translation: "everyday / daily", level: "B2" },
];

export function scoreVocab(known: boolean[]): CefrLevel {
  const total = known.filter(Boolean).length;
  if (total <= 2) return "A1";
  if (total <= 5) return "A2";
  if (total <= 8) return "B1";
  return "B2";
}

const KEY = "lingobot_onboarding";

export function saveOnboarding(data: OnboardingData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getOnboarding(): OnboardingData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingData) : null;
  } catch {
    return null;
  }
}

export function isOnboardingComplete(): boolean {
  return getOnboarding() !== null;
}

export function clearOnboarding() {
  localStorage.removeItem(KEY);
}
