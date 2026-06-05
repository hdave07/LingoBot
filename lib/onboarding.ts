export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type PlacementMethod = "self_report" | "vocab_test";

export interface OnboardingData {
  initialLevel: CefrLevel;
  cefrLevel: CefrLevel;
  placementMethod: PlacementMethod;
  targetLanguage: "es";
  completedAt: string;
  anthropicKeySet: boolean;
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
  { word: "imprescindible", translation: "essential / indispensable", level: "C1" },
  { word: "añoranza", translation: "longing / nostalgia", level: "C1" },
  { word: "resquemor", translation: "lingering resentment / bitterness", level: "C2" },
  { word: "escabullirse", translation: "to slip away / sneak off", level: "C2" },
];

// 14 words: 3×A1, 3×A2, 2×B1, 2×B2, 2×C1, 2×C2
export function scoreVocab(known: boolean[]): CefrLevel {
  const total = known.filter(Boolean).length;
  if (total <= 2) return "A1";
  if (total <= 5) return "A2";
  if (total <= 8) return "B1";
  if (total <= 10) return "B2";
  if (total <= 12) return "C1";
  return "C2";
}

// --- System prompt ---

export function buildSystemPrompt(
  cefrLevel: CefrLevel,
  showTips: boolean,
  isFirstTurn: boolean,
  tutorName: string = "Norah"
): string {
  const levelGuide: Record<CefrLevel, string> = {
    A1: `complete beginner — speak in very short sentences (5–8 words),
present tense only, basic A1 vocabulary only.
After every Spanish sentence, add the English translation
in parentheses so the learner can follow along.`,

    A2: `elementary learner — use present and simple past tense,
short clear sentences, A1–A2 vocabulary.
Add English translations only for words they likely don't know yet.`,

    B1: `intermediate learner — use present, past, and future tenses,
introduce the subjunctive sparingly with a brief natural explanation,
B1 vocabulary. Only gloss rare or idiomatic words in English.`,

    B2: `upper-intermediate learner — speak naturally using all common
tenses including subjunctive and conditional, use idiomatic phrases
freely. English glosses only if directly asked.`,

    C1: `advanced learner — speak entirely naturally as you would to a
near-native speaker. Rich vocabulary, complex structures, regional
expressions welcome. No English glosses unless requested.
Focus corrections only on nuance, register, and style.`,

    C2: `near-native speaker — speak as you would to a fully fluent friend.
No simplification whatsoever. Engage with idioms, humor, and cultural
references. Correct only the most refined style points if anything.`,
  };

  const tipInstruction = showTips
    ? `When responding, include a brief English tip in the "tip" field covering one grammar or vocabulary point from this exchange. Keep it practical and specific.`
    : `Set "tip" to null. Do not add any English explanation or tip.`;

  return `You are ${tutorName}, a warm, patient, and encouraging Spanish conversation
tutor. You speak with a natural Latin American accent and feel like
a friend who happens to speak perfect Spanish — not a teacher.
Your name is ${tutorName} — if asked, introduce yourself by that name.

You are speaking with a ${levelGuide[cefrLevel]} Spanish learner.

# Behavior
- Respond in Spanish at the complexity level described above
- Assess the student's real level through conversation naturally —
  do not ask "what level are you?" — just start speaking and adapt
- Gently correct errors by modeling the correct form naturally
  within your reply — never lecture or embarrass
- If the learner makes the same mistake twice, address it directly
  but kindly: "Almost! Try saying it like this..."
- Keep responses concise: 2–4 sentences of Spanish
- Always end your turn with a question or prompt to keep
  the conversation flowing
- Celebrate small wins genuinely: "¡Perfecto! That subjunctive
  was exactly right — that's a hard one"
- Introduce new vocabulary in context, never as isolated words
- If the student becomes frustrated, switch to encouragement mode
  and simplify immediately
- Never mock or belittle accent, pronunciation, or errors
- Only switch to English if the learner is completely stuck

# Session end
When the learner says goodbye or ends the session, give a brief
warm summary: what was practiced, 2–3 new words they used well,
one strength, one thing to work on next time.

${isFirstTurn ? `# Opening this session
This is the very first message of this conversation. Greet the
learner warmly and briefly ask what they'd like to talk about or
practice today — a scenario, a topic, or just free conversation.
Keep it to 1–2 sentences. Speak at the learner's level as described
above. Do not suggest specific scenarios yourself; let them choose.` : ""}

# Vocab notes
${tipInstruction}
Only flag vocab words that arose naturally in your response AND that the learner at this level genuinely might not know. Most turns should have no vocab. When you do include words, use the exact form as written in your response (accents included). Max 3 words.`;
}

// --- Voice preference ---

export type TutorVoice = "antonio" | "norah";

// TODO: paste the ElevenLabs voice IDs here (found in the voice library URL)
export const VOICE_IDS: Record<TutorVoice, string> = {
  antonio: "htFfPSZGJwjBv1CL0aMD",
  norah: "kcQkGnn0HAT2JRDQ4Ljp",
};

export const VOICE_NAMES: Record<TutorVoice, string> = {
  norah: "Norah",
  antonio: "Antonio",
};

export function getTutorVoice(): TutorVoice {
  if (typeof window === "undefined") return "norah";
  return (localStorage.getItem("lingobot_voice") as TutorVoice) ?? "norah";
}

export function setTutorVoice(voice: TutorVoice): void {
  localStorage.setItem("lingobot_voice", voice);
}

// --- Tips preference ---

export function getShowTips(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("lingobot_show_tips");
  if (stored !== null) return stored === "true";
  // Default: on for beginners, off for B1 and above
  const onboarding = getOnboarding();
  const level = onboarding?.cefrLevel ?? "A1";
  return level === "A1" || level === "A2";
}

export function setShowTips(value: boolean): void {
  localStorage.setItem("lingobot_show_tips", String(value));
}

// --- Onboarding localStorage ---

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
