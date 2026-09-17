"use client";

import { useEffect, useState } from "react";
import { SectionNode } from "@/lib/types";
import { Renderer } from "@/components/Renderer";
import { updateNodeProps, updateNodeText } from "@/lib/updateTree";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [tree, setTree] = useState<SectionNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [useRealAI, setUseRealAI] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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

  function handlePropsChange(id: string, props: Record<string, unknown>) {
    setTree((prev) => (prev ? updateNodeProps(prev, id, props) : prev));
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
    setNotice(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: useRealAI ? "real" : "mock" }),
      });
      const data = await res.json();
      setTree(data.tree);
      if (useRealAI && data.usedMode === "mock") {
        setNotice(`Gemini unavailable, showing a mock layout instead (${data.fallbackReason}).`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="flex items-center justify-center gap-2 max-w-xl mx-auto mb-3 text-xs text-muted">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={useRealAI}
            onChange={(e) => setUseRealAI(e.target.checked)}
          />
          Use real AI (Gemini)
        </label>
      </div>

      <div className="flex gap-2 max-w-xl mx-auto mb-3">
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

      {notice && (
        <p className="max-w-xl mx-auto mb-7 text-center text-xs text-muted bg-secondary rounded-md px-3 py-2">
          {notice}
        </p>
      )}
      {!notice && <div className="mb-10" />}

      {tree && (
        <div className="max-w-4xl mx-auto bg-surface p-6 rounded-lg border border-border shadow-sm">
          <Renderer node={tree} onEdit={handleEdit} onPropsChange={handlePropsChange} />
        </div>
      )}
    </main>
  );
}
