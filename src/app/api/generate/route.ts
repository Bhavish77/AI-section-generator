import { generateLayout } from "@/lib/layouts";
import { generateWithGemini, isFailure } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = body.prompt;
  const mode = body.mode === "real" ? "real" : "mock";

  if (!prompt || typeof prompt !== "string") {
    return Response.json(
      { error: "Missing or invalid 'prompt' field" },
      { status: 400 }
    );
  }

  if (mode === "real") {
    const result = await generateWithGemini(prompt);
    if (result.ok) {
      return Response.json({ tree: result.tree, usedMode: "real" });
    }

    // Graceful degradation: real AI failed (no key, rate limit, invalid
    // output, network error) — fall back to the mock rather than break
    // the page, but tell the frontend so it can be honest about it.
    return Response.json({
      tree: generateLayout(prompt),
      usedMode: "mock",
      fallbackReason: isFailure(result) ? result.reason : "Unknown error",
    });
  }

  return Response.json({ tree: generateLayout(prompt), usedMode: "mock" });
}
