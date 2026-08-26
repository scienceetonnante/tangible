// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { AssistantPanel } from "./assistant-panel.js";

describe("lesson assistant drawer", () => {
  it("starts closed and exposes its state to assistive technology", () => {
    const panel = new AssistantPanel({ onAsk: vi.fn(), onCancel: vi.fn() });
    const toggle = panel.el.querySelector(".xv-assistant-toggle") as HTMLButtonElement;
    const body = panel.el.querySelector(".xv-assistant-body") as HTMLElement;

    expect(toggle.textContent).toBe("Ask about this lesson");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(body.id);
    expect(body.hidden).toBe(true);

    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body.hidden).toBe(false);
  });

  it("keeps the complete question workflow inside the drawer", () => {
    const onAsk = vi.fn();
    const panel = new AssistantPanel({ onAsk, onCancel: vi.fn() });
    const input = panel.el.querySelector(".xv-assistant-input") as HTMLInputElement;
    const form = panel.el.querySelector(".xv-assistant-form") as HTMLFormElement;

    panel.setPauseEnabled(true);
    input.value = "Why?";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onAsk).toHaveBeenCalledWith("Why?");
  });
});
