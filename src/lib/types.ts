export type Align = "left" | "center" | "right";
export type Tone = "ink" | "muted" | "primary" | "success";
export type Weight = "normal" | "bold";

export type SectionNode =
  | {
      id: string;
      type: "container";
      props?: {
        highlighted?: boolean;
        direction?: "row" | "column";
        align?: "start" | "center" | "end";
        padding?: "sm" | "md" | "lg";
        background?: "surface" | "muted";
      };
      children: SectionNode[];
    }
  | {
      id: string;
      type: "heading";
      text: string;
      props?: {
        level?: 1 | 2 | 3;
        align?: Align;
        tone?: Tone;
        weight?: Weight;
        italic?: boolean;
      };
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
      props?: { align?: Align; tone?: Tone; weight?: Weight; italic?: boolean };
    }
  | {
      id: string;
      type: "button";
      text: string;
      props?: {
        variant?: "primary" | "secondary" | "outline" | "ghost";
        size?: "sm" | "md" | "lg";
      };
    }
  | {
      id: string;
      type: "list";
      children: SectionNode[];
    }
  | {
      id: string;
      type: "listItem";
      text: string;
      props?: { tone?: Tone; weight?: Weight; italic?: boolean };
    }
  | {
      id: string;
      type: "badge";
      text: string;
      props?: { tone?: Tone; weight?: Weight; italic?: boolean };
    };
