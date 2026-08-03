// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { PythonRunner } from "./python-runner.js";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: MessageEvent) => void;
  onerror?: (event: ErrorEvent) => void;
  messages: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("PythonRunner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeWorker.instances = [];
  });

  it("waits for Python, sends code, and returns captured output", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:worker" });
    const statuses: string[] = [];
    const runner = new PythonRunner((message) => statuses.push(message));
    const result = runner.run('print("hello")');
    const worker = FakeWorker.instances[0]!;

    worker.emit({ type: "ready" });
    await Promise.resolve();
    expect(worker.messages).toEqual([{ type: "run", code: 'print("hello")' }]);
    worker.emit({ type: "result", output: "hello\n" });

    await expect(result).resolves.toBe("hello\n");
    expect(statuses).toEqual(["Loading Python…", "Running…"]);
    runner.dispose();
    expect(worker.terminated).toBe(true);
  });
});

