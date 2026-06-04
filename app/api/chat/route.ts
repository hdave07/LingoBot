import Anthropic from "@anthropic-ai/sdk";
import type { CefrLevel } from "@/lib/onboarding";

export const maxDuration = 60;

function buildSystemPrompt(cefrLevel: CefrLevel): string {
  const levelGuide: Record<CefrLevel, string> = {
    A1: "complete beginner — use only present tense, very short sentences (5–8 words), A1 CEFR vocabulary only, provide English translation of any new word in parentheses immediately after it",
    A2: "elementary — use present and simple past tense, short sentences, A1–A2 vocabulary, provide English glosses for words the learner is unlikely to know yet",
    B1: "intermediate — use a range of past and present tenses, introduce the subjunctive sparingly with explanation, B1 vocabulary, provide English glosses only for rare or idiomatic words",
    B2: "upper-intermediate — speak naturally using all common tenses including subjunctive and conditional, idiomatic phrases welcome, provide English glosses only when directly asked",
  };

  return `You are Sofia, a warm and encouraging Spanish conversation tutor. You are speaking with a ${levelGuide[cefrLevel]} Spanish learner.

Core behavior:
- Respond primarily in Spanish, at a complexity appropriate for the learner's level described above.
- After your Spanish response, include a brief "Tip" section in English addressing one grammar or vocabulary point from the exchange.
- Keep responses concise: 2–4 sentences of Spanish plus the tip.
- Gently correct errors by modeling the correct form naturally within your reply — do not lecture.
- Encourage the learner. Be warm, conversational, and patient.
- Do not switch entirely to English mid-conversation unless the learner is completely stuck.

Format your response as:
[Spanish response]

**Tip:** [brief English note on one grammar or vocabulary point from this exchange]`;
}

type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-anthropic-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Anthropic API key" }, { status: 401 });
  }

  const body = (await request.json()) as {
    transcript?: string;
    cefrLevel?: CefrLevel;
    history?: HistoryMessage[];
  };

  if (!body.transcript) {
    return Response.json({ error: "Missing transcript" }, { status: 400 });
  }

  const cefrLevel: CefrLevel = body.cefrLevel ?? "A1";
  const history: HistoryMessage[] = (body.history ?? []).slice(-10);

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullText = "";

        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system: buildSystemPrompt(cefrLevel),
          messages: [
            ...history,
            { role: "user", content: body.transcript! },
          ],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            fullText += chunk.delta.text;
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "delta", text: chunk.delta.text }) + "\n"
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "done", fullText }) + "\n"
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "error", error: message }) + "\n"
          )
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
