import { Align, SectionNode, Tone, Weight } from "@/lib/types";

interface RendererProps {
  node: SectionNode;
  onEdit: (id: string, text: string) => void;
  onPropsChange: (id: string, props: Record<string, unknown>) => void;
  // True when this node is being laid out as one of several row-siblings
  // (e.g. one of N cards in a row). A node should only stretch to fill its
  // parent's width when the parent is a column — inside a row, everyone
  // stretching to 100% width is what causes cards to wrap onto their own
  // line instead of sitting side by side.
  parentIsRow?: boolean;
}

interface SelectControl {
  key: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}

interface ToggleControl {
  key: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}

const headingSizeStyles: Record<1 | 2 | 3, string> = {
  1: "text-4xl md:text-5xl leading-tight tracking-tight",
  2: "text-2xl leading-snug",
  3: "text-xl leading-snug",
};

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const ALIGN_OPTIONS = ["left", "center", "right"] as const;

const toneClass: Record<Tone, string> = {
  ink: "text-ink",
  muted: "text-muted",
  primary: "text-primary",
  success: "text-success",
};

const TONE_OPTIONS = ["ink", "muted", "primary", "success"] as const;

const weightClass: Record<Weight, string> = {
  normal: "font-normal",
  bold: "font-bold",
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

const BUTTON_VARIANT_OPTIONS = ["primary", "secondary", "outline", "ghost"] as const;

const buttonSizeClass: Record<"sm" | "md" | "lg", string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-6 py-3",
};

const BUTTON_SIZE_OPTIONS = ["sm", "md", "lg"] as const;

/**
 * Wraps a text-bearing element with:
 *  - a hover outline + "Click to edit" tooltip
 *  - an optional floating toolbar of per-instance prop controls (toggle
 *    buttons like Bold, and dropdowns like align/tone), shown only while
 *    the element is focused/being edited
 *
 * The tooltip and the toolbar are SIBLINGS of the contentEditable element,
 * never children of it — if nested inside, their text/inputs would get swept
 * up into e.currentTarget.textContent on blur and corrupt the saved data.
 */
function Editable({
  as: Tag,
  inline = false,
  fill = true,
  className,
  id,
  text,
  onEdit,
  selects,
  toggles,
  wrapTag,
}: {
  as: React.ElementType;
  inline?: boolean;
  fill?: boolean;
  className: string;
  id: string;
  text: string;
  onEdit: (id: string, text: string) => void;
  selects?: SelectControl[];
  toggles?: ToggleControl[];
  // Wraps ONLY the contentEditable element itself (e.g. in a real <button>)
  // — never the toolbar. Interactive elements (<select>, <button>) can't be
  // nested inside another interactive element like <button> per the HTML
  // content model, so the toolbar must stay a sibling of whatever this
  // wraps, not a descendant of it.
  wrapTag?: (children: React.ReactNode) => React.ReactNode;
}) {
  const Wrapper = inline ? "span" : "div";
  const hasToolbar = (selects && selects.length > 0) || (toggles && toggles.length > 0);

  const editableTag = (
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
  );

  return (
    <Wrapper
      className={`relative group ${inline ? "inline-block" : fill ? "w-full" : ""}`}
    >
      {wrapTag ? wrapTag(editableTag) : editableTag}

      {hasToolbar ? (
        <div className="pointer-events-none absolute -top-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-ink px-1.5 py-1 opacity-0 shadow-md transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          {toggles?.map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              onClick={toggle.onToggle}
              aria-pressed={toggle.active}
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${
                toggle.active ? "bg-white/40" : "bg-white/10"
              }`}
            >
              {toggle.label}
            </button>
          ))}
          {selects?.map((control) => (
            <select
              key={control.key}
              value={control.value}
              onChange={(e) => control.onChange(e.target.value)}
              className="rounded bg-white/10 px-1 py-0.5 text-[10px] font-medium text-white outline-none"
            >
              {control.options.map((option) => (
                <option key={option} value={option} className="text-ink">
                  {option}
                </option>
              ))}
            </select>
          ))}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
        </div>
      ) : (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-0"
        >
          Click to edit
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
        </span>
      )}
    </Wrapper>
  );
}

export function Renderer({ node, onEdit, onPropsChange, parentIsRow = false }: RendererProps) {
  const fill = !parentIsRow;

  switch (node.type) {
    case "container": {
      const isRow = node.props?.direction === "row";
      return (
        <div
          className={[
            "flex gap-4 rounded-lg",
            // A row-child (e.g. one of several cards) has no natural reason
            // to divide the row's width evenly — without a sizing hint it
            // just takes whatever width its own content wants, and if 3
            // such cards don't happen to fit together, they wrap one-per-
            // line instead of sharing space. flex-1 makes siblings share
            // the row equally; min-w-60 stops them shrinking past a
            // sensible floor before wrapping (e.g. on a narrow viewport).
            parentIsRow ? "flex-1 min-w-52" : fill ? "w-full" : "",
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
            <Renderer
              key={child.id}
              node={child}
              onEdit={onEdit}
              onPropsChange={onPropsChange}
              parentIsRow={isRow}
            />
          ))}
        </div>
      );
    }

    case "heading": {
      const level = node.props?.level ?? 2;
      const align = node.props?.align ?? "left";
      const tone = node.props?.tone ?? "ink";
      const weight = node.props?.weight ?? "bold";
      const italic = node.props?.italic ?? false;
      return (
        <Editable
          as={`h${level}` as React.ElementType}
          fill={fill}
          className={`${fill ? "w-full" : ""} ${headingSizeStyles[level]} ${alignClass[align]} ${toneClass[tone]} ${weightClass[weight]} ${italic ? "italic" : ""}`}
          id={node.id}
          text={node.text}
          onEdit={onEdit}
          toggles={[
            {
              key: "weight",
              label: "B",
              active: weight === "bold",
              onToggle: () =>
                onPropsChange(node.id, { weight: weight === "bold" ? "normal" : "bold" }),
            },
            {
              key: "italic",
              label: "I",
              active: italic,
              onToggle: () => onPropsChange(node.id, { italic: !italic }),
            },
          ]}
          selects={[
            {
              key: "align",
              value: align,
              options: ALIGN_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { align: value }),
            },
            {
              key: "tone",
              value: tone,
              options: TONE_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { tone: value }),
            },
          ]}
        />
      );
    }

    case "paragraph": {
      const align = node.props?.align ?? "left";
      const tone = node.props?.tone ?? "muted";
      const weight = node.props?.weight ?? "normal";
      const italic = node.props?.italic ?? false;
      return (
        <Editable
          as="p"
          fill={fill}
          className={`text-base leading-relaxed ${fill ? "w-full" : ""} ${alignClass[align]} ${toneClass[tone]} ${weightClass[weight]} ${italic ? "italic" : ""}`}
          id={node.id}
          text={node.text}
          onEdit={onEdit}
          toggles={[
            {
              key: "weight",
              label: "B",
              active: weight === "bold",
              onToggle: () =>
                onPropsChange(node.id, { weight: weight === "bold" ? "normal" : "bold" }),
            },
            {
              key: "italic",
              label: "I",
              active: italic,
              onToggle: () => onPropsChange(node.id, { italic: !italic }),
            },
          ]}
          selects={[
            {
              key: "align",
              value: align,
              options: ALIGN_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { align: value }),
            },
            {
              key: "tone",
              value: tone,
              options: TONE_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { tone: value }),
            },
          ]}
        />
      );
    }

    case "button": {
      const variant = node.props?.variant ?? "secondary";
      const size = node.props?.size ?? "md";
      return (
        <Editable
          as="span"
          inline
          className=""
          id={node.id}
          text={node.text}
          onEdit={onEdit}
          // The <button> wraps only the contentEditable span — the toolbar
          // (rendered by Editable itself, as a sibling of whatever wrapTag
          // returns) stays outside it, so its <select>s are never nested
          // inside a <button> (invalid HTML content model otherwise).
          wrapTag={(child) => (
            <button
              type="button"
              className={[
                "rounded-md font-semibold transition-colors",
                buttonVariantClass[variant],
                buttonSizeClass[size],
              ].join(" ")}
            >
              {child}
            </button>
          )}
          selects={[
            {
              key: "variant",
              value: variant,
              options: BUTTON_VARIANT_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { variant: value }),
            },
            {
              key: "size",
              value: size,
              options: BUTTON_SIZE_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { size: value }),
            },
          ]}
        />
      );
    }

    case "list":
      return (
        <ul className={`text-left space-y-2 ${fill ? "w-full" : ""}`}>
          {node.children.map((child) => (
            <Renderer
              key={child.id}
              node={child}
              onEdit={onEdit}
              onPropsChange={onPropsChange}
              parentIsRow={false}
            />
          ))}
        </ul>
      );

    case "listItem": {
      const tone = node.props?.tone ?? "muted";
      const weight = node.props?.weight ?? "normal";
      const italic = node.props?.italic ?? false;
      return (
        <li className="text-sm flex gap-2">
          <span aria-hidden className="text-success font-medium">
            ✓
          </span>
          <Editable
            as="span"
            inline
            className={`${toneClass[tone]} ${weightClass[weight]} ${italic ? "italic" : ""}`}
            id={node.id}
            text={node.text}
            onEdit={onEdit}
            toggles={[
              {
                key: "weight",
                label: "B",
                active: weight === "bold",
                onToggle: () =>
                  onPropsChange(node.id, { weight: weight === "bold" ? "normal" : "bold" }),
              },
              {
                key: "italic",
                label: "I",
                active: italic,
                onToggle: () => onPropsChange(node.id, { italic: !italic }),
              },
            ]}
            selects={[
              {
                key: "tone",
                value: tone,
                options: TONE_OPTIONS,
                onChange: (value) => onPropsChange(node.id, { tone: value }),
              },
            ]}
          />
        </li>
      );
    }

    case "badge": {
      const tone = node.props?.tone ?? "primary";
      const weight = node.props?.weight ?? "bold";
      const italic = node.props?.italic ?? false;
      return (
        <Editable
          as="span"
          inline
          className={`rounded-full bg-primary/10 text-xs px-3 py-1 ${toneClass[tone]} ${weightClass[weight]} ${italic ? "italic" : ""}`}
          id={node.id}
          text={node.text}
          onEdit={onEdit}
          toggles={[
            {
              key: "weight",
              label: "B",
              active: weight === "bold",
              onToggle: () =>
                onPropsChange(node.id, { weight: weight === "bold" ? "normal" : "bold" }),
            },
            {
              key: "italic",
              label: "I",
              active: italic,
              onToggle: () => onPropsChange(node.id, { italic: !italic }),
            },
          ]}
          selects={[
            {
              key: "tone",
              value: tone,
              options: TONE_OPTIONS,
              onChange: (value) => onPropsChange(node.id, { tone: value }),
            },
          ]}
        />
      );
    }
  }
}
