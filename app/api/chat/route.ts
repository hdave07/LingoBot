import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/onboarding";
import type { CefrLevel, TutorLanguage } from "@/lib/onboarding";

export const maxDuration = 60;

type HistoryMessage = { role: "user" | "assistant"; content: string };

function makeRespondTool(langName: string): Anthropic.Tool {
  return {
    name: "respond",
    description: `Send your ${langName} response to the learner.`,
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: `Your ${langName} response — this is what gets spoken aloud. Plain text only, no markdown.`,
        },
        vocab: {
          type: "array",
          description: "Words from your response the learner at this level might not know. Empty array if none.",
          items: {
            type: "object",
            properties: {
              word: { type: "string", description: "Exact form of the word as used in text (with accents)" },
              translation: { type: "string", description: "English translation" },
            },
            required: ["word", "translation"],
          },
        },
        tip: {
          type: ["string", "null"] as unknown as "string",
          description: "Brief English grammar or vocabulary tip, or null if tips are off.",
        },
        title: {
          type: ["string", "null"] as unknown as "string",
          description: "Only when generateTitle is true: a 3–5 word English title for this conversation (e.g. 'Ordering at a café', 'Job interview prep'). Otherwise null.",
        },
      },
      required: ["text", "vocab"],
    },
  };
}

export async function POST(request: Request) {
  // DEMO: uses server env key; restore header-only check for BYOK
  const apiKey = process.env.ANTHROPIC_API_KEY ?? request.headers.get("x-anthropic-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Anthropic API key" }, { status: 401 });
  }

  const body = (await request.json()) as {
    transcript?: string;
    cefrLevel?: CefrLevel;
    history?: HistoryMessage[];
    showTips?: boolean;
    generateTitle?: boolean;
    tutorName?: string;
    tutorLanguage?: TutorLanguage;
    priorContext?: string;
  };

  if (!body.transcript) {
    return Response.json({ error: "Missing transcript" }, { status: 400 });
  }

  const cefrLevel: CefrLevel = body.cefrLevel ?? "A1";
  const showTips: boolean = body.showTips ?? true;
  const generateTitle: boolean = body.generateTitle ?? false;
  const tutorName: string = body.tutorName ?? "Norah";
  const tutorLanguage: TutorLanguage = body.tutorLanguage ?? "es";
  const priorContext: string | null = body.priorContext ?? null;
  const history: HistoryMessage[] = (body.history ?? []).slice(-10);
  const isFirstTurn: boolean = history.length === 0;

  const langName = tutorLanguage === "es" ? "Spanish"
    : tutorLanguage === "pt-br" ? "Brazilian Portuguese"
    : "European Portuguese";

  const client = new Anthropic({ apiKey });
  const respondTool = makeRespondTool(langName);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const systemPrompt = buildSystemPrompt(cefrLevel, showTips, isFirstTurn, tutorName, tutorLanguage)
          + (generateTitle
            ? "\n\nAlso set the 'title' field to a 3–5 word English title summarising what this conversation is about."
            : "")
          + (isFirstTurn && priorContext
            ? `\n\n# Prior session context\n${priorContext}\nUse this to personalise the session — pick up where they left off, revisit weak points naturally, celebrate progress. Do not recite this list back to them.`
            : "");

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          tools: [respondTool],
          tool_choice: { type: "tool", name: "respond" },
          messages: [
            ...history,
            { role: "user", content: body.transcript! },
          ],
        });

        const toolUse = response.content.find((c) => c.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
          throw new Error("No tool use in response");
        }

        const input = toolUse.input as {
          text: string;
          vocab: Array<{ word: string; translation: string }>;
          tip?: string | null;
          title?: string | null;
        };

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              text: input.text ?? "",
              vocab: input.vocab ?? [],
              tip: input.tip ?? null,
              title: input.title ?? null,
            }) + "\n"
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", error: message }) + "\n")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
