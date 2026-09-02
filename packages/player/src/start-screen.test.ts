// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StartScreen } from "./start-screen.js";

describe("lesson start screen", () => {
  it("presents a concise lesson introduction", () => {
    const screen = new StartScreen({ title: "Title" }, { onStart: vi.fn(), onRetry: vi.fn() });

    expect(screen.el.querySelector(".xv-start-kind")).toBeNull();
    expect(screen.el.querySelector(".xv-start-promise")).toBeNull();
    expect(screen.el.querySelector(".xv-start-meta")).toBeNull();
    expect(screen.el.querySelector(".xv-start-interactive")?.textContent).toBe(
      "This scene is interactive. Change the point of view and parameters while you listen.",
    );
  });

  it("switches its action from start to retry after a failure", () => {
    const onStart = vi.fn();
    const onRetry = vi.fn();
    const screen = new StartScreen({ title: "Title" }, { onStart, onRetry });
    screen.setReady();
    (screen.el.querySelector("button") as HTMLButtonElement).click();
    screen.setFailed("Could not load.");
    (screen.el.querySelector("button") as HTMLButtonElement).click();
    expect(onStart).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("exposes the starting state", () => {
    const screen = new StartScreen({ title: "Title" }, { onStart: vi.fn(), onRetry: vi.fn() });
    screen.setReady();
    screen.setStarting();
    expect(screen.el.dataset.state).toBe("starting");
  });
});
