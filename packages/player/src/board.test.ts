// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import type { Schema, BoardItem } from "@narrable/core";
import { StateStore } from "./store.js";
import { Board } from "./board.js";

const schema: Schema = {
  "board.note": { type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" },
  "board.eq": { type: { kind: "boardItem" }, default: "hidden", interpolate: "snap", ownership: "script" },
  "board.eq.highlight.cos": { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};

const items: Record<string, BoardItem> = {
  note: { kind: "text", source: "The projection." },
  eq: { kind: "katex", source: "\\htmlClass{cos}{\\cos\\theta}" },
};

describe("Board", () => {
  it("renders text and KaTeX items and reflects display state", () => {
    const store = new StateStore(schema);
    const board = new Board(store, items);
    const noteEl = board.el.querySelector('[data-id="note"]')!;
    expect(noteEl.textContent).toBe("The projection.");
    expect(noteEl.className).toContain("xv-hidden");

    store.set("board.note", "shown");
    expect(noteEl.className).toContain("xv-shown");
    store.set("board.note", "dimmed");
    expect(noteEl.className).toContain("xv-dimmed");
  });

  it("renders KaTeX and toggles highlight on the tagged span", () => {
    const store = new StateStore(schema);
    const board = new Board(store, items);
    const eqEl = board.el.querySelector('[data-id="eq"]')!;
    const tagged = eqEl.querySelector(".cos")!;
    expect(tagged).toBeTruthy(); // \htmlClass{cos}{...} produced a span
    expect(tagged.classList.contains("xv-hl")).toBe(false);
    store.set("board.eq.highlight.cos", true);
    expect(tagged.classList.contains("xv-hl")).toBe(true);
  });
});
