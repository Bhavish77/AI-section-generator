import { generateLayout } from "@/lib/layouts";

export async function POST(request: Request) {
  const body = await request.json();
  const prompt = body.prompt;

  if (!prompt || typeof prompt !== "string") {
    return Response.json(
      { error: "Missing or invalid 'prompt' field" },
      { status: 400 }
    );
  }

  const tree = generateLayout(prompt);

  return Response.json({ tree });
}
