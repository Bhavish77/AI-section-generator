import { z } from "zod";
import { SectionNode } from "./types";

// Caps prevent a malicious payload from being unbounded in size/depth —
// a plain type check has no notion of "too big," a schema can enforce one.
const text = z.string().max(2000);
const id = z.string().max(200);
const align = z.enum(["left", "center", "right"]);
const tone = z.enum(["ink", "muted", "primary", "success"]);
const weight = z.enum(["normal", "bold"]);

export const SectionNodeSchema: z.ZodType<SectionNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id,
      type: z.literal("container"),
      props: z
        .object({
          highlighted: z.boolean().optional(),
          direction: z.enum(["row", "column"]).optional(),
          align: z.enum(["start", "center", "end"]).optional(),
          padding: z.enum(["sm", "md", "lg"]).optional(),
          background: z.enum(["surface", "muted"]).optional(),
        })
        .optional(),
      children: z.array(SectionNodeSchema).min(1).max(50),
    }),
    z.object({
      id,
      type: z.literal("heading"),
      text,
      props: z
        .object({
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
          align: align.optional(),
          tone: tone.optional(),
          weight: weight.optional(),
          italic: z.boolean().optional(),
        })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("paragraph"),
      text,
      props: z
        .object({
          align: align.optional(),
          tone: tone.optional(),
          weight: weight.optional(),
          italic: z.boolean().optional(),
        })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("button"),
      text,
      props: z
        .object({
          variant: z.enum(["primary", "secondary", "outline", "ghost"]).optional(),
          size: z.enum(["sm", "md", "lg"]).optional(),
        })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("list"),
      children: z.array(SectionNodeSchema).min(1).max(50),
    }),
    z.object({
      id,
      type: z.literal("listItem"),
      text,
      props: z
        .object({ tone: tone.optional(), weight: weight.optional(), italic: z.boolean().optional() })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("badge"),
      text,
      props: z
        .object({ tone: tone.optional(), weight: weight.optional(), italic: z.boolean().optional() })
        .optional(),
    }),
  ])
);
