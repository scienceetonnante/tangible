// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { approximateDuration, StartScreen } from "./start-screen.js";

describe("lesson start screen", () => {
  it("presents the lesson without a redundant format label", () => {
    const screen = new StartScreen({ title: "Title", promise: "Promise." }, 120, { onStart: vi.fn(), onRetry: vi.fn() });

    expect(screen.el.querySelector(".xv-start-kind")).toBeNull();
    expect(screen.el.querySelector(".xv-start-interactive")?.textContent).toBe(
      "This scene is interactive. Change the point of view and parameters while you listen.",
    );
  });

  it("formats an approximate narration duration", () => {
    expect(approximateDuration(20)).toBe("About 1 minute");
    expect(approximateDuration(302)).toBe("About 5 minutes");
  });

  it("switches its action from start to retry after a failure", () => {
    const onStart = vi.fn();
    const onRetry = vi.fn();
    const screen = new StartScreen({ title: "Title", promise: "Promise." }, 120, { onStart, onRetry });
    screen.setReady();
    (screen.el.querySelector("button") as HTMLButtonElement).click();
    screen.setFailed("Could not load.");
    (screen.el.querySelector("button") as HTMLButtonElement).click();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("exposes the starting state", () => {
    const screen = new StartScreen({ title: "Title", promise: "Promise." }, 120, { onStart: vi.fn(), onRetry: vi.fn() });
    screen.setReady();
    screen.setStarting();
    expect(screen.el.dataset.state).toBe("starting");
  });
});
