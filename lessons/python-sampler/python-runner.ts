const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.3/full/pyodide.mjs";
const RUN_TIMEOUT_MS = 3000;

interface WorkerMessage {
  type: "ready" | "init-error" | "result";
  output?: string;
  error?: string;
}

export class PythonRunner {
  private worker?: Worker;
  private ready?: Promise<void>;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private resolveRun?: (output: string) => void;
  private rejectRun?: (error: Error) => void;
  private timeout?: ReturnType<typeof setTimeout>;

  constructor(private status: (message: string) => void) {}

  async run(code: string): Promise<string> {
    await this.ensureReady();
    this.status("Running…");
    return new Promise<string>((resolve, reject) => {
      this.resolveRun = resolve;
      this.rejectRun = reject;
      this.timeout = setTimeout(() => {
        this.stopWorker();
        reject(new Error("Stopped after 3 seconds. Check for an infinite loop."));
      }, RUN_TIMEOUT_MS);
      this.worker!.postMessage({ type: "run", code });
    });
  }

  dispose(): void {
    this.stopWorker();
  }

  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    this.status("Loading Python…");
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    const blob = new Blob([workerSource()], { type: "text/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => this.onMessage(event.data);
    this.worker.onerror = (event) => this.fail(new Error(event.message || "Python worker failed to load"));
    return this.ready;
  }

  private onMessage(message: WorkerMessage): void {
    if (message.type === "ready") {
      this.resolveReady?.();
      this.resolveReady = undefined;
      this.rejectReady = undefined;
      return;
    }
    if (message.type === "init-error") {
      this.fail(new Error(message.error || "Python failed to load"));
      return;
    }
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.resolveRun?.(message.output || "");
    this.resolveRun = undefined;
    this.rejectRun = undefined;
  }

  private fail(error: Error): void {
    clearTimeout(this.timeout);
    this.rejectReady?.(error);
    this.rejectRun?.(error);
    this.stopWorker();
  }

  private stopWorker(): void {
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = undefined;
    this.resolveReady = undefined;
    this.rejectReady = undefined;
    this.resolveRun = undefined;
    this.rejectRun = undefined;
    this.timeout = undefined;
  }
}

function workerSource(): string {
  return `
import { loadPyodide } from ${JSON.stringify(PYODIDE_URL)};

let pyodide;
try {
  pyodide = await loadPyodide();
  self.postMessage({ type: "ready" });
} catch (error) {
  self.postMessage({ type: "init-error", error: String(error) });
}

self.onmessage = async (event) => {
  if (event.data?.type !== "run" || !pyodide) return;
  const dict = pyodide.globals.get("dict");
  const globals = dict([["__lesson_code", event.data.code]]);
  try {
    const output = await pyodide.runPythonAsync(\`
import io
import traceback
from contextlib import redirect_stdout, redirect_stderr

_buffer = io.StringIO()
_namespace = {"__name__": "__main__"}
try:
    with redirect_stdout(_buffer), redirect_stderr(_buffer):
        exec(compile(__lesson_code, "<lesson>", "exec"), _namespace)
except BaseException:
    traceback.print_exc(file=_buffer)
_buffer.getvalue()
\`, { globals });
    self.postMessage({ type: "result", output: String(output) });
  } finally {
    globals.destroy();
    dict.destroy();
  }
};
`;
}

