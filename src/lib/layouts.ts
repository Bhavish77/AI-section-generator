import { SectionNode } from "./types";

const HERO_LAYOUT: SectionNode = {
  id: "hero-root",
  type: "container",
  props: { direction: "column", align: "center", padding: "lg" },
  children: [
    {
      id: "hero-heading",
      type: "heading",
      text: "Build Websites with AI",
      props: { level: 1, align: "center" },
    },
    {
      id: "hero-paragraph",
      type: "paragraph",
      text: "Describe what you want, and watch it come to life instantly.",
      props: { align: "center" },
    },
    {
      id: "hero-button",
      type: "button",
      text: "Get Started",
      props: { variant: "primary", size: "lg" },
    },
  ],
};

function pricingCard(
  id: string,
  name: string,
  price: string,
  features: string[],
  highlighted = false
): SectionNode {
  const children: SectionNode[] = [];

  if (highlighted) {
    children.push({ id: `${id}-badge`, type: "badge", text: "Most Popular" });
  }

  children.push(
    { id: `${id}-name`, type: "heading", text: name, props: { level: 2, align: "center" } },
    { id: `${id}-price`, type: "paragraph", text: price, props: { align: "center" } },
    {
      id: `${id}-features`,
      type: "list",
      children: features.map((f, i) => ({
        id: `${id}-feature-${i}`,
        type: "listItem",
        text: f,
      })),
    },
    {
      id: `${id}-cta`,
      type: "button",
      text: "Choose Plan",
      props: { variant: highlighted ? "primary" : "outline" },
    }
  );

  return {
    id: `${id}-card`,
    type: "container",
    props: { direction: "column", align: "center", highlighted, padding: highlighted ? "lg" : "md" },
    children,
  };
}

const PRICING_LAYOUT: SectionNode = {
  id: "pricing-root",
  type: "container",
  props: { direction: "row", background: "muted" },
  children: [
    pricingCard("starter", "Starter", "$10/mo", [
      "10 Projects",
      "Basic Support",
      "1 User",
    ]),
    pricingCard(
      "pro",
      "Pro",
      "$29/mo",
      ["Unlimited Projects", "Priority Support", "5 Users"],
      true
    ),
    pricingCard("enterprise", "Enterprise", "$50/mo", [
      "Unlimited Projects",
      "Dedicated Support",
      "Unlimited Users",
    ]),
  ],
};

export function generateLayout(prompt: string): SectionNode {
  const p = prompt.toLowerCase();

  if (p.includes("pricing")) {
    return PRICING_LAYOUT;
  }
  if (p.includes("hero")) {
    return HERO_LAYOUT;
  }

  // No keyword matched — fall back to Hero as a sensible default.
  return HERO_LAYOUT;
}
