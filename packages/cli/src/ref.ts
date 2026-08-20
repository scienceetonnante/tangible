// Emit the scene's cue-reference sheet (Markdown) — the context an agent needs to
// write cues for a scene (`lesson ref`).

import type { SceneInfo } from "@narrable/compiler";
import type { ParamType } from "@narrable/core";

export function refSheet(sceneName: string, scene: SceneInfo): string {
  const lines: string[] = [`# Cue reference — ${sceneName}`, ""];

  lines.push("## Parameters", "");
  lines.push("| param | type | range/values | default | interpolate | ownership |");
  lines.push("|---|---|---|---|---|---|");
  for (const [key, spec] of Object.entries(scene.schema)) {
    lines.push(
      `| \`${key}\` | ${spec.type.kind} | ${typeExtras(spec.type)} | ${fmt(spec.default)} | ${spec.interpolate} | ${spec.ownership} |`,
    );
  }
  lines.push("");

  const presets = Object.keys(scene.presets ?? {});
  if (presets.length) lines.push("## Camera presets", "", presets.map((p) => `- \`${p}\``).join("\n"), "");

  const constants = Object.entries(scene.constants ?? {});
  if (constants.length)
    lines.push("## Constants", "", constants.map(([k, v]) => `- \`${k}\` = ${fmt(v)}`).join("\n"), "");

  const groups = Object.entries(scene.groups ?? {});
  if (groups.length)
    lines.push(
      "## Parameter groups",
      "",
      "Set a whole group in one cue: `@cue(<group> -> [v1, v2, …])` (values map to the params in order).",
      "",
      groups.map(([k, ps]) => `- \`${k}\` → [${ps.map((p) => `\`${p}\``).join(", ")}]`).join("\n"),
      "",
    );

  const bakers = Object.entries(scene.bakers ?? {});
  if (bakers.length)
    lines.push(
      "## Bakers",
      "",
      "Run a build-time computed process: `@bake(<name>, steps: 1, over: 1s)`.",
      "",
      bakers
        .map(([name, baker]) => `- \`${name}\`: reads [${refs(baker.reads)}] → writes [${refs(baker.writes)}]`)
        .join("\n"),
      "",
    );

  return lines.join("\n") + "\n";
}

function refs(params: string[]): string {
  return params.map((param) => `\`${param}\``).join(", ");
}

function typeExtras(t: ParamType): string {
  if (t.kind === "scalar" && t.range) return `[${t.range[0]}, ${t.range[1]}]`;
  if (t.kind === "enum") return t.values.join(" \\| ");
  if (t.kind === "text") return "typewriter text";
  if (t.kind === "boardItem") return "hidden \\| shown \\| dimmed";
  return "—";
}

function fmt(v: unknown): string {
  return "`" + JSON.stringify(v) + "`";
}
