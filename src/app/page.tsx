"use client";

import { useEffect, useState } from "react";
import { SectionNode } from "@/lib/types";
import { Renderer } from "@/components/Renderer";
import { updateNodeText } from "@/lib/updateTree";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [tree, setTree] = useState<SectionNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    fetch("/api/save")
      .then((res) => res.json())
      .then((data) => {
        if (data.tree) setTree(data.tree);
      });
  }, []);

  function handleEdit(id: string, text: string) {
    setTree((prev) => (prev ? updateNodeText(prev, id, text) : prev));
  }

  async function handleSave() {
    if (!tree) return;
    setSaveStatus("saving");
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tree }),
    });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 1500);
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setTree(data.tree);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="flex gap-2 max-w-xl mx-auto mb-10">
        <input
          className="flex-1 border border-border bg-surface text-ink rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          placeholder='Enter your prompt, e.g. "a pricing section with 3 tiers"'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          type="button"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          onClick={handleGenerate}
          disabled={loading || !prompt}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        <button
          type="button"
          className="bg-success text-success-foreground px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
          onClick={handleSave}
          disabled={!tree || saveStatus === "saving"}
        >
          {saveStatus === "saving"
            ? "Saving..."
            : saveStatus === "saved"
              ? "Saved!"
              : "Save Changes"}
        </button>
      </div>

      {tree && (
        <div className="max-w-4xl mx-auto bg-surface p-6 rounded-lg border border-border shadow-sm">
          <Renderer node={tree} onEdit={handleEdit} />
        </div>
      )}
    </main>
  );
}
