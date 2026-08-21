// Captions — the player draws these itself (a <track> on <audio> would not render).
// Parse the VTT once, binary-search the active cue by time. Toggle via chrome.

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** Minimal WebVTT parser (the compiler controls the VTT it emits). */
export function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = vtt.replace(/\r\n/g, "\n").split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const arrow = lines.findIndex((l) => l.includes("-->"));
    if (arrow === -1) continue;
    const [a, b] = lines[arrow]!.split("-->");
    cues.push({ start: parseStamp(a!.trim()), end: parseStamp(b!.trim()), text: lines.slice(arrow + 1).join(" ") });
  }
  return cues.sort((x, y) => x.start - y.start);
}

function parseStamp(s: string): number {
  const parts = s.split(":").map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return parts[0]! * 60 + parts[1]!;
}

/** Active cue text at time t via binary search, or "" if none. */
export function activeCue(cues: Cue[], t: number): string {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid]!;
    if (t < c.start) hi = mid - 1;
    else if (t >= c.end) lo = mid + 1;
    else return c.text;
  }
  return "";
}

/** Current or most recently started cue, including gaps after it has ended. */
export function latestCue(cues: Cue[], t: number): string {
  let lo = 0;
  let hi = cues.length - 1;
  let latest = "";
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid]!;
    if (cue.start <= t) {
      latest = cue.text;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return latest;
}

export class Captions {
  readonly el: HTMLElement;
  private cues: Cue[];
  private visible = false;

  constructor(vtt: string) {
    this.cues = parseVtt(vtt);
    this.el = document.createElement("div");
    this.el.className = "xv-captions";
  }

  update(t: number): void {
    this.el.textContent = this.visible ? activeCue(this.cues, t) : "";
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (!on) this.el.textContent = "";
  }

  latestText(t: number): string {
    return latestCue(this.cues, t);
  }
}
