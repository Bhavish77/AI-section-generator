import { Align, SectionNode } from "@/lib/types";

interface RendererProps {
  node: SectionNode;
  onEdit: (id: string, text: string) => void;
}

const headingStyles: Record<1 | 2 | 3, string> = {
  1: "text-4xl md:text-5xl font-bold leading-tight tracking-tight",
  2: "text-2xl font-semibold leading-snug",
  3: "text-xl font-semibold leading-snug",
};

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const itemsClass: Record<"start" | "center" | "end", string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

const paddingClass: Record<"sm" | "md" | "lg", string> = {
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

const backgroundClass: Record<"surface" | "muted", string> = {
  surface: "bg-surface",
  muted: "bg-background",
};

const buttonVariantClass: Record<"primary" | "secondary" | "outline" | "ghost", string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-primary text-ink bg-transparent",
  ghost: "text-ink bg-transparent hover:bg-secondary",
};

const buttonSizeClass: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

/**
 * Wraps a text-bearing element with a hover outline + "Click to edit" tooltip.
 * The tooltip is a SIBLING of the contentEditable element, never a child of it —
 * if it were nested inside, its own "Click to edit" text would get swept up into
 * e.currentTarget.textContent on blur and corrupt the saved data.
 */
function Editable({
  as: Tag,
  inline = false,
  className,
  id,
  text,
  onEdit,
}: {
  as: React.ElementType;
  inline?: boolean;
  className: string;
  id: string;
  text: string;
  onEdit: (id: string, text: string) => void;
}) {
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={`relative group ${inline ? "inline-block" : "w-full"}`}>
      <Tag
        className={`${className} rounded-md px-1 -mx-1 outline-none ring-1 ring-transparent transition-shadow group-hover:ring-primary/40 focus:ring-2 focus:ring-primary`}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e: React.FocusEvent<HTMLElement>) =>
          onEdit(id, e.currentTarget.textContent ?? "")
        }
      >
        {text}
      </Tag>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-0"
      >
        Click to edit
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
      </span>
    </Wrapper>
  );
}

export function Renderer({ node, onEdit }: RendererProps) {
  switch (node.type) {
    case "container": {
      const isRow = node.props?.direction === "row";
      return (
        <div
          className={[
            "flex gap-4 rounded-lg",
            paddingClass[node.props?.padding ?? "md"],
            backgroundClass[node.props?.background ?? "surface"],
            isRow ? "flex-row flex-wrap justify-center" : "flex-col",
            itemsClass[node.props?.align ?? "start"],
            node.props?.highlighted
              ? "border-2 border-primary shadow-lg"
              : "border border-border",
          ].join(" ")}
        >
          {node.children.map((child) => (
            <Renderer key={child.id} node={child} onEdit={onEdit} />
          ))}
        </div>
      );
    }

    case "heading": {
      const level = node.props?.level ?? 2;
      return (
        <Editable
          as={`h${level}` as React.ElementType}
          className={`text-ink w-full ${headingStyles[level]} ${alignClass[node.props?.align ?? "left"]}`}
          id={node.id}
          text={node.text}
          onEdit={onEdit}
        />
      );
    }

    case "paragraph":
      return (
        <Editable
          as="p"
          className={`text-muted text-base leading-relaxed w-full ${alignClass[node.props?.align ?? "left"]}`}
          id={node.id}
          text={node.text}
          onEdit={onEdit}
        />
      );

    case "button":
      return (
        <button
          type="button"
          className={[
            "rounded-md font-semibold transition-colors",
            buttonVariantClass[node.props?.variant ?? "secondary"],
            buttonSizeClass[node.props?.size ?? "md"],
          ].join(" ")}
        >
          <Editable
            as="span"
            inline
            className=""
            id={node.id}
            text={node.text}
            onEdit={onEdit}
          />
        </button>
      );

    case "list":
      return (
        <ul className="text-left space-y-2 w-full">
          {node.children.map((child) => (
            <Renderer key={child.id} node={child} onEdit={onEdit} />
          ))}
        </ul>
      );

    case "listItem":
      return (
        <li className="text-sm text-muted flex gap-2">
          <span aria-hidden className="text-success font-medium">
            ✓
          </span>
          <Editable
            as="span"
            inline
            className=""
            id={node.id}
            text={node.text}
            onEdit={onEdit}
          />
        </li>
      );

    case "badge":
      return (
        <Editable
          as="span"
          inline
          className="rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1"
          id={node.id}
          text={node.text}
          onEdit={onEdit}
        />
      );
  }
}
