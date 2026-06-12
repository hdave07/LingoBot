export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type PlacementMethod = "self_report" | "vocab_test" | "speaking_test";
export type TutorLanguage = "es" | "pt-br" | "pt-pt";

export interface OnboardingData {
  initialLevel: CefrLevel;
  cefrLevel: CefrLevel;
  placementMethod: PlacementMethod;
  targetLanguage: "es" | "pt";
  ptDialect?: "br" | "pt-pt";
  completedAt: string;
  anthropicKeySet: boolean;
}

// --- Language helpers ---

export function getLanguageName(lang: TutorLanguage): string {
  if (lang === "es") return "Spanish";
  return "Portuguese";
}

export function getLanguageFullName(lang: TutorLanguage): string {
  if (lang === "es") return "Spanish";
  if (lang === "pt-br") return "Brazilian Portuguese";
  return "European Portuguese";
}

export function getTutorLanguageLabel(lang: TutorLanguage): string {
  if (lang === "es") return "Spanish";
  if (lang === "pt-br") return "Port. (BR)";
  return "Port. (EU)";
}

export function getLanguageBaseCode(lang: TutorLanguage): "es" | "pt" {
  return lang === "es" ? "es" : "pt";
}

export function getSttLanguageCode(lang: TutorLanguage): string {
  return lang === "es" ? "es" : "pt";
}

// --- System prompt ---

export function buildSystemPrompt(
  cefrLevel: CefrLevel,
  showTips: boolean,
  isFirstTurn: boolean,
  tutorName: string = "Norah",
  tutorLanguage: TutorLanguage = "es"
): string {
  const langName = getLanguageName(tutorLanguage);
  const accentDesc =
    tutorLanguage === "es"
      ? "natural Latin American accent"
      : tutorLanguage === "pt-br"
      ? "natural Brazilian Portuguese accent"
      : "natural European Portuguese (continental) accent";

  const levelGuide: Record<CefrLevel, string> = {
    A1: `complete beginner — speak in very short sentences (5–8 words),
present tense only, basic A1 vocabulary only.
After every ${langName} sentence, add the English translation
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

  return `You are ${tutorName}, a warm, patient, and encouraging ${langName} conversation
tutor. You speak with a ${accentDesc} and feel like
a friend who happens to speak perfect ${langName} — not a teacher.
Your name is ${tutorName} — if asked, introduce yourself by that name.

You are speaking with a ${levelGuide[cefrLevel]} ${langName} learner.

# Behavior
- Respond in ${langName} at the complexity level described above
- Assess the student's real level through conversation naturally —
  do not ask "what level are you?" — just start speaking and adapt
- Gently correct errors by modeling the correct form naturally
  within your reply — never lecture or embarrass
- If the learner makes the same mistake twice, address it directly
  but kindly: "Almost! Try saying it like this..."
- Keep responses concise: 2–4 sentences of ${langName}
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

export type TutorVoice = "antonio" | "norah" | "scheila" | "paulo";

export const VOICE_IDS: Record<TutorVoice, string> = {
  antonio: "htFfPSZGJwjBv1CL0aMD",
  norah: "kcQkGnn0HAT2JRDQ4Ljp",
  scheila: "cyD08lEy76q03ER1jZ7y",
  paulo: "aLFUti4k8YKvtQGXv0UO",
};

export const VOICE_NAMES: Record<TutorVoice, string> = {
  norah: "Norah",
  antonio: "Antonio",
  scheila: "Scheila",
  paulo: "Paulo",
};

export function getDefaultVoiceForLanguage(lang: TutorLanguage): TutorVoice {
  if (lang === "es") return "norah";
  if (lang === "pt-br") return "scheila";
  return "paulo";
}

export function getNextVoiceForLanguage(
  voice: TutorVoice,
  lang: TutorLanguage
): TutorVoice {
  if (lang === "es") return voice === "norah" ? "antonio" : "norah";
  return voice === "scheila" ? "paulo" : "scheila";
}

export function getTutorVoice(): TutorVoice {
  if (typeof window === "undefined") return "norah";
  return (localStorage.getItem("lingobot_voice") as TutorVoice) ?? "norah";
}

export function setTutorVoice(voice: TutorVoice): void {
  localStorage.setItem("lingobot_voice", voice);
}

// --- Active language preference ---

export function getActiveLanguage(): TutorLanguage {
  if (typeof window === "undefined") return "es";
  return (localStorage.getItem("lingobot_language") as TutorLanguage) ?? "es";
}

export function setActiveLanguage(lang: TutorLanguage): void {
  localStorage.setItem("lingobot_language", lang);
}

// --- Per-language CEFR levels ---

export function getCefrForLanguage(lang: "es" | "pt"): CefrLevel {
  if (typeof window === "undefined") return "A1";
  const key = lang === "es" ? "lingobot_cefr_es" : "lingobot_cefr_pt";
  return (localStorage.getItem(key) as CefrLevel) ?? "A1";
}

export function setCefrForLanguage(lang: "es" | "pt", level: CefrLevel): void {
  const key = lang === "es" ? "lingobot_cefr_es" : "lingobot_cefr_pt";
  localStorage.setItem(key, level);
}

export function hasTestedForLanguage(lang: "es" | "pt"): boolean {
  if (typeof window === "undefined") return false;
  const key = lang === "es" ? "lingobot_cefr_es" : "lingobot_cefr_pt";
  return localStorage.getItem(key) !== null;
}

// Copies old onboarding cefrLevel into the per-language key so existing users
// don't get asked to re-test a language they already set up.
export function migrateOnboardingData(): void {
  if (typeof window === "undefined") return;
  const data = getOnboarding();
  if (!data) return;

  const base = data.targetLanguage;
  const key = base === "es" ? "lingobot_cefr_es" : "lingobot_cefr_pt";
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, data.cefrLevel);
  }

  if (!localStorage.getItem("lingobot_language")) {
    const lang: TutorLanguage =
      base === "es" ? "es"
      : data.ptDialect === "br" ? "pt-br"
      : "pt-pt";
    localStorage.setItem("lingobot_language", lang);
  }
}

// --- Tips preference ---

export function getShowTips(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("lingobot_show_tips");
  if (stored !== null) return stored === "true";
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

// --- Anthropic API key (BYOK) ---

const ANTHROPIC_KEY_STORAGE = "lingobot_anthropic_key";

export function saveAnthropicKey(key: string): void {
  localStorage.setItem(ANTHROPIC_KEY_STORAGE, key.trim());
}

export function getAnthropicKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ANTHROPIC_KEY_STORAGE) ?? "";
}
