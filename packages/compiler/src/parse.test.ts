import { describe, it, expect } from "vitest";
import { parseScript } from "./parse.js";
import { SCRIPT_FR } from "./fixtures.js";

describe("parseScript — front matter", () => {
  it("extracts YAML front matter and strips it from narration", () => {
    const p = parseScript(SCRIPT_FR);
    expect(p.frontMatter.title).toBe("Le cercle unité");
    expect(p.frontMatter.voice).toBe("elevenlabs:antoine");
    expect(p.narration.startsWith("Voici un cercle")).toBe(true);
  });
});

describe("parseScript — narration stripping (golden)", () => {
  it("removes all directives and normalizes whitespace into flowing prose", () => {
    const p = parseScript(SCRIPT_FR);
    expect(p.narration).toBe(
      "Voici un cercle de rayon un. Le point rouge est repéré par un angle, " +
        "qu'on appelle thêta. Regardez ce qui se passe quand on le fait varier : " +
        "le point fait le tour complet du cercle.\n\n" +
        "Projetons maintenant ce point sur l'axe horizontal. La longueur obtenue, " +
        "c'est le cosinus de thêta.\n\n" +
        "Reprenons. À quatre-vingt-dix degrés…",
    );
  });
});

describe("parseScript — directives and anchors", () => {
  it("parses the expected directive sequence", () => {
    const p = parseScript(SCRIPT_FR);
    expect(p.directives.map((d) => d.kind)).toEqual([
      "scene",
      "chapter",
      "cue",
      "cue",
      "show",
      "cue",
      "board",
      "pause",
      "cue",
    ]);
  });

  it("anchors inline cues to the onset of the following word", () => {
    const p = parseScript(SCRIPT_FR);
    const at = (d: (typeof p.directives)[number]) => p.narration.slice(d.anchorOffset, d.anchorOffset + 9);
    const cues = p.directives.filter((d) => d.kind === "cue");
    // Order: show.thetaLabel, theta->6.2832, show.cosLabel, theta->1.5708
    expect(at(cues[0]!)).toBe("thêta. Re"); // show.thetaLabel → "thêta"
    expect(p.narration.startsWith("varier", cues[1]!.anchorOffset)).toBe(true); // theta -> 6.2832
    expect(p.narration.startsWith("le cosinus", cues[2]!.anchorOffset)).toBe(true); // show.cosLabel
    expect(p.narration.startsWith("Reprenons", cues[3]!.anchorOffset)).toBe(true); // theta -> 1.5708
    const show = p.directives.find((d) => d.kind === "show")!;
    expect(p.narration.startsWith("Projetons", show.anchorOffset)).toBe(true);
  });

  it("marks block directives (scene/chapter/pause) and inline directives", () => {
    const p = parseScript(SCRIPT_FR);
    const byKind = Object.fromEntries(p.directives.map((d) => [d.kind, d.block]));
    expect(byKind.scene).toBe(true);
    expect(byKind.chapter).toBe(true);
    expect(byKind.pause).toBe(true);
    expect(byKind.show).toBe(false);
    expect(byKind.cue).toBe(false);
  });

  it("parses cue assignments and options", () => {
    const p = parseScript(SCRIPT_FR);
    const anim = p.directives.find((d) => d.kind === "cue" && d.assignments[0]?.param === "theta");
    expect(anim).toBeDefined();
    if (anim?.kind === "cue") {
      expect(anim.assignments[0]).toEqual({ param: "theta", mode: "animate", value: "6.2832" });
      expect(anim.options.over).toBe(4);
      expect(anim.options.ease).toBe("inOutCubic");
    }
  });

  it("scans KaTeX with $…$ inside @board without tripping on braces", () => {
    const p = parseScript(SCRIPT_FR);
    const board = p.directives.find((d) => d.kind === "board");
    expect(board).toMatchObject({ kind: "board", id: "cosdef", itemKind: "katex", source: "x = \\cos\\theta" });
  });
});

describe("parseScript — escapes and edge cases", () => {
  it("treats \\@ as a literal @ in narration", () => {
    const p = parseScript("Envoyez un mail \\@ moi.");
    expect(p.narration).toBe("Envoyez un mail @ moi.");
    expect(p.directives).toHaveLength(0);
  });
  it("leaves an unknown @name(...) as an 'unknown' directive for check to flag", () => {
    const p = parseScript("Texte @wiggle(x) fin.");
    expect(p.directives[0]).toMatchObject({ kind: "unknown", name: "wiggle" });
  });
});
