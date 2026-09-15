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
