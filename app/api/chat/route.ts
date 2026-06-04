import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/onboarding";
import type { CefrLevel } from "@/lib/onboarding";

export const maxDuration = 60;

type HistoryMessage = { role: "user" | "assistant"; content: string };

const RESPOND_TOOL: Anthropic.Tool = {
  name: "respond",
  description: "Send your Spanish response to the learner.",
  input_schema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "Your Spanish response — this is what gets spoken aloud. Plain text only, no markdown.",
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
    },
    required: ["text", "vocab"],
  },
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-anthropic-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Anthropic API key" }, { status: 401 });
  }

  const body = (await request.json()) as {
    transcript?: string;
    cefrLevel?: CefrLevel;
    history?: HistoryMessage[];
    showTips?: boolean;
  };

  if (!body.transcript) {
    return Response.json({ error: "Missing transcript" }, { status: 400 });
  }

  const cefrLevel: CefrLevel = body.cefrLevel ?? "A1";
  const showTips: boolean = body.showTips ?? true;
  const history: HistoryMessage[] = (body.history ?? []).slice(-10);
  const isFirstTurn: boolean = history.length === 0;

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: buildSystemPrompt(cefrLevel, showTips, isFirstTurn),
          tools: [RESPOND_TOOL],
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
        };

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              text: input.text ?? "",
              vocab: input.vocab ?? [],
              tip: input.tip ?? null,
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
