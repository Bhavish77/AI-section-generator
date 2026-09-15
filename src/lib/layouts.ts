import { SectionNode } from "./types";

const HERO_LAYOUT: SectionNode = {
  id: "hero-root",
  type: "container",
  props: { direction: "column" },
  children: [
    {
      id: "hero-heading",
      type: "heading",
      text: "Build Websites with AI",
      props: { level: 1 },
    },
    {
      id: "hero-paragraph",
      type: "paragraph",
      text: "Describe what you want, and watch it come to life instantly.",
    },
    {
      id: "hero-button",
      type: "button",
      text: "Get Started",
      props: { variant: "primary" },
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
  return {
    id: `${id}-card`,
    type: "container",
    props: { direction: "column", highlighted },
    children: [
      { id: `${id}-name`, type: "heading", text: name, props: { level: 2 } },
      { id: `${id}-price`, type: "paragraph", text: price },
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
        text: highlighted ? "Choose Plan" : "Choose Plan",
        props: { variant: highlighted ? "primary" : "secondary" },
      },
    ],
  };
}

const PRICING_LAYOUT: SectionNode = {
  id: "pricing-root",
  type: "container",
  props: { direction: "row" },
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
