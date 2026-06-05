export const maxDuration = 30;

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("file") as Blob | null;

  if (!audio) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "recording.webm");
  upstream.append("model_id", "scribe_v1");
  upstream.append("language_code", (formData.get("language") as string) ?? "es");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: upstream,
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 502 });
  }

  const data = await res.json();
  return Response.json({ transcript: (data.text as string) ?? "" });
}
