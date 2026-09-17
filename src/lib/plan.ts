import { z } from "zod";

// The closed vocabulary of roles a card's fields can be. Fixed and small on
// purpose — it's what lets generated content be turned into styled nodes
// deterministically (see buildFieldNode in gemini.ts) instead of asking the
// AI to also decide type/tone/weight per field, independently, per card.
export const FieldRoleSchema = z.enum(["title", "meta", "body", "quote", "cta"]);
export type FieldRole = z.infer<typeof FieldRoleSchema>;

const tone = z.enum(["ink", "muted", "primary", "success"]);
const weight = z.enum(["normal", "bold"]);
const buttonVariant = z.enum(["primary", "secondary", "outline", "ghost"]);

// Decided ONCE, by the single plan call that sees the whole user request —
// then applied identically to every independently-generated card, so
// "design consistency across the section" is a property of the code path,
// not something each card-generation call has to independently agree on.
export const ThemeSchema = z.object({
  titleTone: tone,
  titleWeight: weight,
  metaTone: tone,
  bodyTone: tone,
  quoteTone: tone,
  quoteItalic: z.boolean(),
  ctaVariantHighlighted: buttonVariant,
  ctaVariantDefault: buttonVariant,
});
export type Theme = z.infer<typeof ThemeSchema>;

export const PlanGroupSchema = z.object({
  id: z.string().max(50),
  layout: z.enum(["row", "column"]),
  itemKind: z.enum(["leaf", "card"]),
  items: z.array(z.string().max(200)).min(1).max(6),
  // Required (in practice) for "card" groups only — omit for "leaf".
  fields: z.array(FieldRoleSchema).max(5).optional(),
  // 0-based index of the one item that should be visually featured (e.g.
  // the recommended pricing tier). Omit if none should stand out.
  highlightedIndex: z.number().int().min(0).max(5).optional(),
});

export const PlanSchema = z.object({
  heading: z.string().max(200),
  headingLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  subtitle: z.string().max(500).optional(),
  theme: ThemeSchema,
  groups: z.array(PlanGroupSchema).max(4),
});

export type Plan = z.infer<typeof PlanSchema>;
export type PlanGroup = z.infer<typeof PlanGroupSchema>;
