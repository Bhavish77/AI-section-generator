import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { toJSONSchema } from "zod";
import { SectionNodeSchema } from "./schema";
import { SectionNode } from "./types";
import { FieldRole, Plan, PlanGroup, PlanSchema, Theme } from "./plan";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ALLOWED_TYPES = "container, heading, paragraph, button, list, listItem, badge";
const MAX_ATTEMPTS = 2;
const MAX_ITEMS_FOR_GENERATION = 4;

/**
 * Turns any zod schema into the JSON Schema shape Gemini's responseJsonSchema
 * expects, with adjustments specific to Gemini's constrained-decoding engine
 * (not reflective of what we actually accept at storage time — the real zod
 * schemas, used elsewhere to validate the response, are untouched):
 *
 *  1. Gemini's responseJsonSchema "unrolls" cyclic ($ref) structures a
 *     limited number of levels, but only when the recursive field is NOT
 *     marked required. SectionNodeSchema requires `children`, so we drop it
 *     from any `required` array in this copy only.
 *  2. Large/nested array bounds blow up Gemini's constraint-tracking
 *     ("too many states for serving" — confirmed by hitting this error
 *     live). Capping it low here keeps generation tractable.
 *  3. `minItems` combined with `maxItems` on a recursive array (items:
 *     {"$ref": "#"}) reliably 400s with "Request contains an invalid
 *     argument" — confirmed by bisecting the schema field-by-field against
 *     the live API. `maxItems` alone is fine; it's specifically the
 *     combination that breaks. We still want to reject empty children
 *     arrays, just not as a live generation constraint —
 *     SectionNodeSchema (with .min(1) intact) does that post-hoc when we
 *     validate whatever comes back.
 */
function toGeminiSchema(zodSchema: z.ZodType): unknown {
  const schema = toJSONSchema(zodSchema) as Record<string, unknown>;
  delete schema.$schema;

  // keyName tracks the property name we arrived through, so the maxItems/
  // minItems relaxation below applies ONLY to the recursive "children"
  // field (the one that actually causes "too many states for serving") —
  // not to every array anywhere in the schema, e.g. PlanGroupSchema's flat
  // (non-recursive) "items" array keeps its real .max(6) when sent to
  // Gemini instead of being silently capped to 4 along with it.
  function relax(node: unknown, keyName?: string): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item) => relax(item, keyName));
      return;
    }
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.required)) {
      obj.required = (obj.required as string[]).filter((field) => field !== "children");
    }
    if (keyName === "children") {
      if (typeof obj.maxItems === "number") {
        obj.maxItems = MAX_ITEMS_FOR_GENERATION;
      }
      delete obj.minItems;
    }
    Object.entries(obj).forEach(([key, value]) => relax(value, key));
  }

  relax(schema);
  return schema;
}

function summarizeIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `at "${issue.path.join(".")}": ${issue.message}`)
    .join("; ");
}

type CallOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; issueSummary?: string };

// This project's tsconfig.json has "strict": false (no strictNullChecks),
// and under that setting TypeScript's control-flow narrowing for
// discriminated unions via early-return (`if (x.ok) return; ...x.reason`)
// does not reliably work — confirmed with a minimal, fully synchronous,
// non-generic repro (isolated with --strictNullChecks vs without it). This
// is NOT specific to generic or awaited values, as earlier testing here
// suggested — it affects any such narrowing anywhere in this codebase. An
// explicit type-predicate sidesteps it reliably regardless of strict mode.
export function isFailure<T extends { ok: boolean }>(
  result: T
): result is Extract<T, { ok: false }> {
  return result.ok === false;
}

// A plain mutable object (not a module-level variable) so each
// generateWithGemini call gets its own isolated counter — a module-level
// counter would race across concurrent requests from different users.
interface CallCounter {
  count: number;
}

async function callGeminiJSON<T>(
  ai: GoogleGenAI,
  schema: z.ZodType<T>,
  prompt: string,
  counter: CallCounter
): Promise<CallOutcome<T>> {
  counter.count++;
  const geminiSchema = toGeminiSchema(schema);
  if (process.env.GEMINI_DEBUG) {
    console.log("=== Gemini request ===");
    console.log("prompt:", prompt);
    console.log("schema:", JSON.stringify(geminiSchema));
  }
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: geminiSchema,
    },
  });

  const raw = response.text;
  if (!raw) {
    return { ok: false, reason: "Gemini returned an empty response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Gemini response was not valid JSON" };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = summarizeIssues(result.error.issues);
    console.warn("Gemini output failed schema validation:", issueSummary, "raw:", raw.slice(0, 1000));
    return { ok: false, reason: "Gemini response did not match the expected schema", issueSummary };
  }

  return { ok: true, data: result.data };
}

async function callWithRetry<T>(
  ai: GoogleGenAI,
  schema: z.ZodType<T>,
  buildPrompt: (retryNote?: string) => string,
  counter: CallCounter
): Promise<CallOutcome<T>> {
  let last: CallOutcome<T> = { ok: false, reason: "No attempts made" };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const retryNote: string | undefined =
      attempt > 0 && isFailure(last) ? last.issueSummary : undefined;
    last = await callGeminiJSON(ai, schema, buildPrompt(retryNote), counter);
    if (last.ok) return last;
  }
  return last;
}

const PLAN_RULES = `You are planning the structure AND design of a website section for a
no-code builder, based on a short user request.

Respond with:
- "heading": a short, punchy heading for the section.
- "headingLevel": 1, 2, or 3.
- "subtitle": an optional one-sentence supporting line.
- "theme": ONE set of design choices applied consistently to every card in
  every group — this is what keeps independently-generated cards looking
  like they belong to the same design, so choose deliberately:
  - "titleTone" / "metaTone" / "bodyTone" / "quoteTone": one of "ink",
    "muted", "primary", "success".
  - "titleWeight": "bold" or "normal".
  - "quoteItalic": true or false.
  - "ctaVariantHighlighted" / "ctaVariantDefault": one of "primary",
    "secondary", "outline", "ghost" — the button style for a group's
    featured/highlighted item vs. every other item.
  Reflect the user's request in these choices — e.g. if they ask for a
  "dark button" or a "bold, punchy" look, pick values that express that.
- "groups": 0 to 4 groups, where each group is a set of similar repeated
  items — e.g. a row of feature cards, a row of pricing tiers, one or more
  buttons. For each group give:
  - a short kebab-case "id"
  - "layout": "row" or "column"
  - "itemKind": "leaf" if each item is simple, self-contained content with
    no further sub-parts (e.g. a button, a short badge label) — or "card" if
    each item needs its own composed content (e.g. a feature card, a
    pricing tier, a testimonial).
  - "items": an array of short, SPECIFIC descriptions, one per item.
  - "fields": REQUIRED when itemKind is "card" (omit for "leaf"). An
    ordered array of field roles every card in this group must have, chosen
    from: "title", "meta", "body", "quote", "cta". E.g. a testimonial card
    might be ["title", "meta", "quote"]; a pricing card might be
    ["title", "meta", "body", "cta"].
  - "highlightedIndex": optional, "card" groups only — the 0-based index of
    the one item that should be visually featured (e.g. the recommended
    pricing tier). Omit if none should stand out.`;

function planPrompt(userPrompt: string, retryNote?: string): string {
  const reminder = retryNote
    ? `\n\nIMPORTANT: your previous attempt was rejected for these reasons: ${retryNote}. Correct these specific problems.`
    : "";
  return `${PLAN_RULES}${reminder}\n\nUser request: "${userPrompt}"`;
}

const LEAF_GROUP_RULES = `You are generating one "container" node for a group of simple items
within a website section.

Rules:
- Respond with a single JSON object: a "container" node whose "children"
  array holds exactly the requested number of items.
- Each item's "type" field MUST be exactly one of: ${ALLOWED_TYPES}. Do not
  invent other type names.
- Every node (including the outer container) must have a short, unique,
  kebab-case "id".
- Every "container" and "list" node MUST include a non-empty "children"
  array — never an empty or missing one, at any depth.
- Write real, specific copy relevant to the request — never placeholder text.`;

function leafGroupPrompt(userPrompt: string, group: PlanGroup, retryNote?: string): string {
  const reminder = retryNote
    ? `\n\nIMPORTANT: your previous attempt was rejected for these reasons: ${retryNote}. Correct these specific problems.`
    : "";
  const itemList = group.items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  return `${LEAF_GROUP_RULES}${reminder}

Overall section request: "${userPrompt}"
This group's outer container: direction "${group.layout}", holding exactly ${group.items.length} item(s).
Each item, in order:
${itemList}`;
}

/**
 * Namespaces every id in a subtree with a group-specific prefix. Used only
 * for leaf groups, where the AI still produces full nodes (including ids)
 * itself — card nodes are built entirely by our own code now (see
 * buildFieldNode), so they never need this: we assign their ids ourselves
 * from the start.
 */
function namespaceIds(node: SectionNode, prefix: string): SectionNode {
  const id = `${prefix}-${node.id}`;
  if (node.type === "container" || node.type === "list") {
    return { ...node, id, children: node.children.map((child) => namespaceIds(child, prefix)) };
  }
  return { ...node, id } as SectionNode;
}

async function generateLeafGroup(
  ai: GoogleGenAI,
  userPrompt: string,
  group: PlanGroup,
  counter: CallCounter
): Promise<SectionNode[] | null> {
  try {
    const result = await callWithRetry(
      ai,
      SectionNodeSchema,
      (retryNote) => leafGroupPrompt(userPrompt, group, retryNote),
      counter
    );

    if (isFailure(result)) {
      console.warn(`Group "${group.id}" failed after retries:`, result.reason);
      return null;
    }

    const node = result.data;
    if (node.type !== "container" && node.type !== "list") {
      console.warn(`Group "${group.id}" returned a non-container node`);
      return null;
    }

    return node.children.map((item) => namespaceIds(item, group.id));
  } catch (err) {
    console.warn(`Group "${group.id}" threw an error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const FIELD_ROLE_DESCRIPTIONS: Record<FieldRole, string> = {
  title: "a short name or heading for this item",
  meta: "a short secondary line, e.g. a role, company, or category",
  body: "a one-to-two sentence description",
  quote: "a short first-person quote or testimonial",
  cta: "a short call-to-action button label (2-4 words)",
};

const DEFAULT_FIELDS: FieldRole[] = ["title", "body"];

// Built at runtime from whatever fields the plan chose for this group — a
// flat object of plain strings, no type/props/children at all. This is
// deliberately the simplest possible request shape: no recursion, nothing
// for the model to get structurally wrong, because the model's only job
// now is content, not structure or style.
function buildFieldsSchema(fields: FieldRole[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const field of fields) {
    shape[field] = z.string().max(500);
  }
  return z.object(shape);
}

function cardFieldsPrompt(
  userPrompt: string,
  itemDescription: string,
  fields: FieldRole[],
  retryNote?: string
): string {
  const reminder = retryNote
    ? `\n\nIMPORTANT: your previous attempt was rejected for these reasons: ${retryNote}. Correct these specific problems.`
    : "";
  const fieldDescriptions = fields
    .map((field) => `- "${field}": ${FIELD_ROLE_DESCRIPTIONS[field]}`)
    .join("\n");
  return `You are writing short text content for one card within a website section.

Respond with a JSON object containing exactly these fields, each a short
plain-text string — no styling, no markup, no HTML:
${fieldDescriptions}${reminder}

Overall section this card belongs to: "${userPrompt}"
This specific card should be about: ${itemDescription}`;
}

/**
 * Deterministically turns one field's plain text into an actual styled
 * node, using the theme decided once in the plan phase. This is the whole
 * point of splitting content from presentation: every card's "title" is
 * built by this exact same function with the exact same theme, so there's
 * no way for one card's title to end up styled differently from another's
 * the way independent full-JSON generation did.
 */
function buildFieldNode(
  role: FieldRole,
  text: string,
  id: string,
  theme: Theme,
  isHighlighted: boolean
): SectionNode {
  switch (role) {
    case "title":
      return { id, type: "heading", text, props: { level: 3, tone: theme.titleTone, weight: theme.titleWeight } };
    case "meta":
      return { id, type: "paragraph", text, props: { tone: theme.metaTone } };
    case "body":
      return { id, type: "paragraph", text, props: { tone: theme.bodyTone } };
    case "quote":
      return { id, type: "paragraph", text, props: { tone: theme.quoteTone, italic: theme.quoteItalic } };
    case "cta":
      return {
        id,
        type: "button",
        text,
        props: { variant: isHighlighted ? theme.ctaVariantHighlighted : theme.ctaVariantDefault },
      };
  }
}

async function generateCard(
  ai: GoogleGenAI,
  userPrompt: string,
  itemDescription: string,
  fields: FieldRole[],
  theme: Theme,
  isHighlighted: boolean,
  prefix: string,
  counter: CallCounter
): Promise<SectionNode | null> {
  const fieldsSchema = buildFieldsSchema(fields);
  try {
    // result: CallOutcome<{[field: string]: string}>, e.g. for Pro plan
    // (fields = ["title","meta","body","cta"]):
    //   { ok: true, data: { title: "Pro", meta: "For growing teams and businesses",
    //                        body: "Unlock advanced features...", cta: "Start Pro Trial" } }
    const result = await callWithRetry(
      ai,
      fieldsSchema,
      (retryNote) => cardFieldsPrompt(userPrompt, itemDescription, fields, retryNote),
      counter
    );

    if (isFailure(result)) {
      console.warn(`Card "${prefix}" failed after retries:`, result.reason);
      return null;
    }

    // values: Record<string, string> — flat, e.g. { title: "Pro", meta: "...", body: "...", cta: "..." }
    const values = result.data as Record<string, string>;
    // children: SectionNode[] — one built node per field, e.g. for Pro:
    //   [ {id:"pricing-tiers-1-title-0", type:"heading", text:"Pro", ...},
    //     {id:"pricing-tiers-1-meta-1",  type:"paragraph", text:"For growing teams...", ...},
    //     {id:"pricing-tiers-1-body-2",  type:"paragraph", text:"Unlock advanced...", ...},
    //     {id:"pricing-tiers-1-cta-3",   type:"button", text:"Start Pro Trial", ...} ]
    const children = fields.map((field, i) =>
      buildFieldNode(field, values[field] ?? "", `${prefix}-${field}-${i}`, theme, isHighlighted)
    );

    // this function's own return: SectionNode — one full card container, e.g.
    //   {id:"pricing-tiers-1", type:"container", props:{...,padding:"lg",highlighted:true}, children}
    return {
      id: prefix,
      type: "container",
      props: {
        direction: "column",
        align: "start",
        padding: isHighlighted ? "lg" : "md",
        background: "surface",
        highlighted: isHighlighted,
      },
      children,
    };
  } catch (err) {
    console.warn(`Card "${prefix}" threw an error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateGroupItems(
  ai: GoogleGenAI,
  userPrompt: string,
  group: PlanGroup,
  theme: Theme,
  counter: CallCounter
): Promise<SectionNode[] | null> {
  if (group.itemKind === "leaf") {
    return generateLeafGroup(ai, userPrompt, group, counter);
  }

  // "card" kind: generate each card's TEXT independently (cheap, reliable —
  // flat schema, no structure to get wrong), then build every card's actual
  // nodes ourselves from that text + the shared theme + whether this
  // specific index is the highlighted one.
  const fields = group.fields ?? DEFAULT_FIELDS;
  // outcomes: PromiseSettledResult<SectionNode | null>[]
  //   one entry per group.items[i] — for the pricing example (3 items):
  //   [ { status: "fulfilled", value: StarterCardNode },
  //     { status: "fulfilled", value: ProCardNode },
  //     { status: "fulfilled", value: EnterpriseCardNode } ]
  //   a card that failed after retries or threw shows up as either
  //   { status: "fulfilled", value: null } or { status: "rejected", reason }
  const outcomes = await Promise.allSettled(
    group.items.map((itemDescription, index) =>
      generateCard(
        ai,
        userPrompt,
        itemDescription,
        fields,
        theme,
        index === group.highlightedIndex,
        `${group.id}-${index}`,
        counter
      )
    )
  );

  // cards: SectionNode[] — rejected/null entries dropped, e.g.
  //   [StarterCardNode, ProCardNode, EnterpriseCardNode]
  const cards = outcomes
    .map((outcome) => (outcome.status === "fulfilled" ? outcome.value : null))
    .filter((card): card is SectionNode => card !== null);

  // this function's own return: SectionNode[] | null
  return cards.length > 0 ? cards : null;
}

export type GeminiResult =
  | { ok: true; tree: SectionNode }
  | { ok: false; reason: string };

export async function generateWithGemini(prompt: string): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "GEMINI_API_KEY is not configured on the server" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const counter: CallCounter = { count: 0 };

    // planResult: { ok: true; data: Plan } | { ok: false; reason: string; issueSummary?: string }
    // (CallOutcome<Plan> — already zod-validated against PlanSchema inside callGeminiJSON)
    //
    // planResult.data (the Plan object), e.g. for "a pricing section with 3 tiers":
    // {
    //   heading: "Simple, Transparent Pricing",
    //   headingLevel: 2,
    //   subtitle: "Choose the plan that fits your team.",
    //   theme: {
    //     titleTone: "ink", titleWeight: "bold",
    //     metaTone: "muted", bodyTone: "muted",
    //     quoteTone: "ink", quoteItalic: true,
    //     ctaVariantHighlighted: "primary", ctaVariantDefault: "outline",
    //   },
    //   groups: [
    //     {
    //       id: "pricing-tiers", layout: "row", itemKind: "card",
    //       items: ["Starter plan", "Pro plan", "Enterprise plan"],
    //       fields: ["title", "meta", "body", "cta"],
    //       highlightedIndex: 1,
    //     },
    //   ],
    // }
    const planResult = await callWithRetry<Plan>(
      ai,
      PlanSchema,
      (retryNote) => planPrompt(prompt, retryNote),
      counter
    );
    if (isFailure(planResult)) {
      console.info(`Gemini calls made: ${counter.count} (planning failed)`);
      return { ok: false, reason: `Planning step failed: ${planResult.reason}` };
    }
    const plan = planResult.data;
    console.info(
      "Plan:",
      plan.heading,
      "| groups:",
      plan.groups
        .map(
          (g) =>
            `${g.id}[${g.itemKind}](${g.items.length})${g.fields ? ` fields=${g.fields.join(",")}` : ""}${g.highlightedIndex !== undefined ? ` highlighted=${g.highlightedIndex}` : ""}`
        )
        .join(", ") || "(none)"
    );

    // Each group is independent, so generate them concurrently rather than
    // one at a time — and use allSettled so one group's failure doesn't
    // throw away the others.
    //
    // groupOutcomes: PromiseSettledResult<SectionNode[] | null>[]
    //   one entry per plan.groups[i], same order, e.g. for our 1-group
    //   pricing example:
    //   [ { status: "fulfilled", value: [StarterCard, ProCard, EnterpriseCard] } ]
    //
    //   where each *Card is itself a full SectionNode container, e.g.:
    //   ProCard = {
    //     id: "pricing-tiers-1", type: "container",
    //     props: { direction: "column", align: "start", padding: "lg",
    //               background: "surface", highlighted: true },
    //     children: [
    //       { id: "pricing-tiers-1-title-0", type: "heading", text: "Pro",
    //         props: { level: 3, tone: "ink", weight: "bold" } },
    //       { id: "pricing-tiers-1-meta-1", type: "paragraph",
    //         text: "For growing teams and businesses", props: { tone: "muted" } },
    //       { id: "pricing-tiers-1-body-2", type: "paragraph",
    //         text: "Unlock advanced features and priority support...", props: { tone: "muted" } },
    //       { id: "pricing-tiers-1-cta-3", type: "button",
    //         text: "Start Pro Trial", props: { variant: "primary" } },
    //     ],
    //   }
    //   StarterCard/EnterpriseCard have the exact same shape, just built from
    //   different text and with isHighlighted=false, so their container props
    //   differ only in padding:"md" (not "lg") and highlighted:false (not
    //   true), and their cta uses theme.ctaVariantDefault ("outline") instead
    //   of theme.ctaVariantHighlighted ("primary") — see buildFieldNode.
    //
    //   — or, if that group's own generateGroupItems threw before finishing:
    //   [ { status: "rejected", reason: <Error> } ]
    //   — or, if it finished but every card inside it failed:
    //   [ { status: "fulfilled", value: null } ]
    const groupOutcomes = await Promise.allSettled(
      plan.groups.map((group) => generateGroupItems(ai, prompt, group, plan.theme, counter))
    );

    const children: SectionNode[] = [
      {
        id: "generated-heading",
        type: "heading",
        text: plan.heading,
        props: { level: plan.headingLevel, align: "center" },
      },
    ];

    if (plan.subtitle) {
      children.push({
        id: "generated-subtitle",
        type: "paragraph",
        text: plan.subtitle,
        props: { align: "center" },
      });
    }

    plan.groups.forEach((group, index) => {
      const outcome = groupOutcomes[index];
      const items = outcome.status === "fulfilled" ? outcome.value : null;
      if (items && items.length > 0) {
        children.push({
          id: `${group.id}-group`,
          type: "container",
          props: { direction: group.layout, align: "center" },
          children: items,
        });
      }
      // A group that failed after retries is silently dropped rather than
      // failing the whole section — better to show what did work than throw
      // away a heading/subtitle and every other group that succeeded.
    });

    // tree: SectionNode — the full root container, e.g. for the pricing
    // example: { id:"generated-root", type:"container", children:[
    //   headingNode, subtitleNode,
    //   { id:"pricing-tiers-group", type:"container", children:[StarterCard, ProCard, EnterpriseCard] }
    // ] }
    const tree: SectionNode = {
      id: "generated-root",
      type: "container",
      props: { direction: "column", align: "center", padding: "lg" },
      children,
    };

    // Final safety net: validate the tree WE assembled too, the same as any
    // other untrusted input — assembly code can have bugs just like AI output.
    // finalCheck: { success: true; data: SectionNode } | { success: false; error: ZodError }
    const finalCheck = SectionNodeSchema.safeParse(tree);
    console.info(`Gemini calls made: ${counter.count}`);
    if (!finalCheck.success) {
      console.warn("Assembled tree failed final validation:", summarizeIssues(finalCheck.error.issues));
      return { ok: false, reason: "Assembled tree failed final validation" };
    }

    return { ok: true, tree: finalCheck.data };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Unknown Gemini error",
    };
  }
}
