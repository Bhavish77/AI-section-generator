import { SectionNode } from "./types";

let savedTree: SectionNode | null = null;

export function saveTree(tree: SectionNode) {
  savedTree = tree;
}

export function getSavedTree(): SectionNode | null {
  return savedTree;
}
