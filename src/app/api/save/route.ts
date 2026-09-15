import { saveTree, getSavedTree } from "@/lib/store";
import { SectionNodeSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const body = await request.json();
  const result = SectionNodeSchema.safeParse(body.tree);

  if (!result.success) {
    return Response.json(
      { error: "Invalid tree shape", details: result.error.issues },
      { status: 400 }
    );
  }

  saveTree(result.data);

  return Response.json({ success: true });
}

export async function GET() {
  const tree = getSavedTree();
  return Response.json({ tree });
}
