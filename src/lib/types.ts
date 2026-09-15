export type SectionNode =
  | {
      id: string;
      type: "container";
      props?: { highlighted?: boolean; direction?: "row" | "column" };
      children: SectionNode[];
    }
  | {
      id: string;
      type: "heading";
      text: string;
      props?: { level?: 1 | 2 | 3 };
    }
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "button";
      text: string;
      props?: { variant?: "primary" | "secondary" };
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
    };
