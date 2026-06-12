export function GET() {
  return Response.json({ serverKeySet: !!process.env.ANTHROPIC_API_KEY });
}
