import { z } from "zod";
import { SectionNode } from "./types";

// Caps prevent a malicious payload from being unbounded in size/depth —
// a plain type check has no notion of "too big," a schema can enforce one.
const text = z.string().max(2000);
const id = z.string().max(200);

export const SectionNodeSchema: z.ZodType<SectionNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id,
      type: z.literal("container"),
      props: z
        .object({
          highlighted: z.boolean().optional(),
          direction: z.enum(["row", "column"]).optional(),
        })
        .optional(),
      children: z.array(SectionNodeSchema).max(50),
    }),
    z.object({
      id,
      type: z.literal("heading"),
      text,
      props: z
        .object({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional() })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("paragraph"),
      text,
    }),
    z.object({
      id,
      type: z.literal("button"),
      text,
      props: z
        .object({ variant: z.enum(["primary", "secondary"]).optional() })
        .optional(),
    }),
    z.object({
      id,
      type: z.literal("list"),
      children: z.array(SectionNodeSchema).max(50),
    }),
    z.object({
      id,
      type: z.literal("listItem"),
      text,
    }),
  ])
);
