import Anthropic from "@anthropic-ai/sdk";
import type { CefrLevel } from "@/lib/onboarding";
import type { SavedMessage } from "@/lib/conversation";

export const maxDuration = 60;

export interface SummaryData {
  topic: string;
  wordsLearned: Array<{ word: string; translation: string }>;
  mistakes: Array<{ error: string; correction: string }>;
  strength: string;
  focusNext: string;
  encouragement: string;
}

const SUMMARY_TOOL: Anthropic.Tool = {
  name: "generate_summary",
  description: "Generate a structured learning summary for this Spanish conversation session.",
  input_schema: {
    type: "object" as const,
    properties: {
      topic: {
        type: "string",
        description: "What was practiced — the scenario or topic of the conversation (e.g. 'Ordering food at a café in Mexico City')",
      },
      wordsLearned: {
        type: "array",
        description: "New Spanish vocabulary words that appeared in the session and the learner may have picked up. Only include words that were actually used.",
        items: {
          type: "object",
          properties: {
            word: { type: "string" },
            translation: { type: "string" },
          },
          required: ["word", "translation"],
        },
      },
      mistakes: {
        type: "array",
        description: "Grammar or vocabulary errors the learner made, with the correct form. Empty array if no significant errors.",
        items: {
          type: "object",
          properties: {
            error: { type: "string", description: "What the learner said or wrote" },
            correction: { type: "string", description: "The correct form with a brief note" },
          },
          required: ["error", "correction"],
        },
      },
      strength: {
        type: "string",
        description: "One specific thing the learner did well in this session.",
      },
      focusNext: {
        type: "string",
        description: "One concrete thing to practice or focus on in the next session.",
      },
      encouragement: {
        type: "string",
        description: "A warm, genuine one-sentence closing note to the learner.",
      },
    },
    required: ["topic", "wordsLearned", "mistakes", "strength", "focusNext", "encouragement"],
  },
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-anthropic-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Anthropic API key" }, { status: 401 });
  }

  const body = (await request.json()) as {
    messages?: SavedMessage[];
    cefrLevel?: CefrLevel;
  };

  if (!body.messages?.length) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const transcript = body.messages
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.text}`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are reviewing a Spanish conversation session between a tutor and a ${body.cefrLevel ?? "A1"}-level learner. Analyze the transcript carefully and generate an honest, helpful learning summary. Be specific — reference actual things from the conversation, not generic advice.`,
      tools: [SUMMARY_TOOL],
      tool_choice: { type: "tool", name: "generate_summary" },
      messages: [
        {
          role: "user",
          content: `Here is the conversation transcript:\n\n${transcript}\n\nPlease generate a learning summary.`,
        },
      ],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use in response");
    }

    return Response.json({ summary: toolUse.input as SummaryData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
