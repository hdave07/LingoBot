import Anthropic from "@anthropic-ai/sdk";
import type { CefrLevel, TutorLanguage } from "@/lib/onboarding";

export const maxDuration = 30;

export interface PlacementResult {
  level: CefrLevel;
  note: string;
}

const ASSESS_TOOL: Anthropic.Tool = {
  name: "assess_level",
  description: "Return the assessed CEFR level for the learner.",
  input_schema: {
    type: "object" as const,
    properties: {
      level: {
        type: "string",
        enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
        description: "The CEFR level that best matches the learner's demonstrated ability.",
      },
      note: {
        type: "string",
        description: "One encouraging sentence explaining what you observed about their speech.",
      },
    },
    required: ["level", "note"],
  },
};

export async function POST(request: Request) {
  // DEMO: uses server env key; restore header-only check for BYOK
  const apiKey = process.env.ANTHROPIC_API_KEY ?? request.headers.get("x-anthropic-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Anthropic API key" }, { status: 401 });
  }

  const body = (await request.json()) as {
    transcript?: string;
    tutorLanguage?: TutorLanguage;
  };

  const transcript = (body.transcript ?? "").trim();
  const tutorLanguage: TutorLanguage = body.tutorLanguage ?? "es";

  const langName =
    tutorLanguage === "es" ? "Spanish"
    : tutorLanguage === "pt-br" ? "Brazilian Portuguese"
    : "European Portuguese";

  if (!transcript) {
    return Response.json({ level: "A1", note: "We'll start you at beginner level — you can always adjust it in the bar above." } satisfies PlacementResult);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: `You are an expert ${langName} language teacher doing a quick CEFR placement assessment from a speech transcript.

Assess the learner's level based on:
- Vocabulary range and accuracy
- Grammar complexity and correctness
- Sentence construction and variety
- Fluency indicators (coherence, filler words, sentence completion)

Be realistic:
- A1: can only say basic words or phrases, or spoke entirely in English
- A2: simple present-tense sentences, limited vocabulary
- B1: can express themselves on familiar topics, some errors
- B2: fairly fluent on most topics, occasional errors
- C1: wide vocabulary, complex structures, rare errors
- C2: near-native, idiomatic, very few errors

If they spoke mostly or entirely in English with no target language, assign A1.
Do not over-assign — it is better to start slightly low and let the learner move up.`,
      tools: [ASSESS_TOOL],
      tool_choice: { type: "tool", name: "assess_level" },
      messages: [
        {
          role: "user",
          content: `Here is the transcript of the learner speaking ${langName} for ~20 seconds:\n\n"${transcript}"\n\nPlease assess their level.`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use in response");
    }

    const result = toolUse.input as PlacementResult;
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
