// Compiler diagnostics. These are a public interface — the agent iterates against
// them — so their shape and wording are stable and snapshot-tested.

export interface SourceLoc {
  file?: string;
  line: number; // 1-based
  col: number; // 1-based
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  loc: SourceLoc;
}

/** "file:line:col: error: message" */
export function formatDiagnostic(d: Diagnostic): string {
  const where = `${d.loc.file ?? "<script>"}:${d.loc.line}:${d.loc.col}`;
  return `${where}: ${d.severity}: ${d.message}`;
}

/** Levenshtein distance, for did-you-mean suggestions. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return row[n]!;
}

/** Closest candidate within a small edit distance, or null. */
export function suggest(name: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  const max = Math.max(2, Math.floor(name.length / 3));
  for (const c of candidates) {
    const d = editDistance(name, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best !== null && bestD <= max ? best : null;
}
