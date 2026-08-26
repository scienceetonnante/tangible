// Board — the DOM strip of KaTeX/text items that follow the narration. Each item's
// display state (hidden/shown/dimmed) and highlight flags are ordinary tracks, so
// the board is scripted and seekable like everything else. Transitions are CSS.

import katex from "katex";
import { effect } from "@preact/signals-core";
import type { BoardItem } from "@tangible/core";
import type { StateStore } from "./store.js";

export class Board {
  readonly el: HTMLElement;
  private disposers: (() => void)[] = [];

  constructor(store: StateStore, items: Record<string, BoardItem>) {
    this.el = document.createElement("div");
    this.el.className = "xv-board-inner";

    for (const [id, item] of Object.entries(items)) {
      const itemEl = document.createElement("div");
      itemEl.dataset.id = id;
      const source = item.source;
      if (item.kind === "katex") {
        itemEl.innerHTML = katex.renderToString(source, { trust: true, strict: false, throwOnError: false });
      } else {
        itemEl.textContent = source;
      }
      this.el.append(itemEl);

      // Display state: hidden | shown | dimmed
      const stateKey = `board.${id}`;
      if (store.signals.has(stateKey)) {
        this.disposers.push(
          effect(() => {
            itemEl.className = `xv-board-item xv-${String(store.signal(stateKey).value)}`;
          }),
        );
      }

      // Highlight flags: board.<id>.highlight(.tag)? — toggle CSS on the tagged spans.
      for (const key of store.keys()) {
        if (!key.startsWith(`board.${id}.highlight`)) continue;
        const tag = key.slice(`board.${id}.highlight`.length).replace(/^\./, "");
        this.disposers.push(
          effect(() => {
            toggleHighlight(itemEl, tag, store.signal(key).value === true);
          }),
        );
      }
    }
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.el.remove();
  }
}

function toggleHighlight(itemEl: HTMLElement, tag: string, on: boolean): void {
  const targets: Element[] = tag ? [...itemEl.querySelectorAll(`.${tag}`)] : [itemEl];
  for (const t of targets) t.classList.toggle("xv-hl", on);
}
