import { SectionNode } from "./types";

export function updateNodeText(
  node: SectionNode,
  id: string,
  newText: string
): SectionNode {
  if (node.type === "container" || node.type === "list") {
    return {
      ...node,
      children: node.children.map((child) =>
        updateNodeText(child, id, newText)
      ),
    };
  }

  if (node.id === id) {
    return { ...node, text: newText };
  }

  return node;
}

// Merges partial props into the node matching id. container/list have no
// `props` worth editing per-instance here, so they're excluded structurally.
export function updateNodeProps(
  node: SectionNode,
  id: string,
  partialProps: Record<string, unknown>
): SectionNode {
  if (node.type === "container" || node.type === "list") {
    return {
      ...node,
      children: node.children.map((child) =>
        updateNodeProps(child, id, partialProps)
      ),
    };
  }

  if (node.id === id) {
    return { ...node, props: { ...node.props, ...partialProps } } as typeof node;
  }

  return node;
}
