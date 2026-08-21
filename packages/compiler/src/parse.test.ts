import { describe, it, expect } from "vitest";
import { ParseError, parseScript } from "./parse.js";
import { SCRIPT } from "./fixtures.js";

describe("parseScript — front matter", () => {
  it("extracts YAML front matter and strips it from narration", () => {
    const p = parseScript(SCRIPT);
    expect(p.frontMatter.title).toBe("The unit circle");
    expect(p.frontMatter.voice).toBe("elevenlabs:voice");
    expect(p.narration.startsWith("Here is a circle")).toBe(true);
  });
});

describe("parseScript — narration stripping (golden)", () => {
  it("removes all directives and normalizes whitespace into flowing prose", () => {
    const p = parseScript(SCRIPT);
    expect(p.narration).toBe(
      "Here is a circle of radius one. The red point is located by an angle " +
        "we call theta. Watch what happens when we let it vary: the point " +
        "goes all the way around the circle.\n\n" +
        "Now let's project this point onto the horizontal axis. " +
        "The length we get is the cosine of theta.\n\n" +
        // @pause narrates its prompt just before the checkpoint:
        "Drag the red point yourself and watch the cosine. " +
        "Let's continue. At ninety degrees…",
    );
  });
});

describe("parseScript — directives and anchors", () => {
  it("parses the expected directive sequence", () => {
    const p = parseScript(SCRIPT);
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
    const p = parseScript(SCRIPT);
    const at = (d: (typeof p.directives)[number]) => p.narration.slice(d.anchorOffset, d.anchorOffset + 9);
    const cues = p.directives.filter((d) => d.kind === "cue");
    // Order: show.thetaLabel, theta->6.2832, show.cosLabel, theta->1.5708
    expect(at(cues[0]!)).toBe("theta. Wa"); // show.thetaLabel → "theta"
    expect(p.narration.startsWith("vary", cues[1]!.anchorOffset)).toBe(true); // theta -> 6.2832
    expect(p.narration.startsWith("the cosine", cues[2]!.anchorOffset)).toBe(true); // show.cosLabel
    expect(p.narration.startsWith("Let's continue", cues[3]!.anchorOffset)).toBe(true); // theta -> 1.5708
    const show = p.directives.find((d) => d.kind === "show")!;
    expect(p.narration.startsWith("Now let's", show.anchorOffset)).toBe(true);
  });

  it("marks block directives (scene/chapter/pause) and inline directives", () => {
    const p = parseScript(SCRIPT);
    const byKind = Object.fromEntries(p.directives.map((d) => [d.kind, d.block]));
    expect(byKind.scene).toBe(true);
    expect(byKind.chapter).toBe(true);
    expect(byKind.pause).toBe(true);
    expect(byKind.show).toBe(false);
    expect(byKind.cue).toBe(false);
  });

  it("parses cue assignments and options", () => {
    const p = parseScript(SCRIPT);
    const anim = p.directives.find((d) => d.kind === "cue" && d.assignments[0]?.param === "theta");
    expect(anim).toBeDefined();
    if (anim?.kind === "cue") {
      expect(anim.assignments[0]).toEqual({ param: "theta", mode: "animate", value: "6.2832" });
      expect(anim.options.over).toBe(4);
      expect(anim.options.ease).toBe("inOutCubic");
    }
  });

  it("scans KaTeX with $…$ inside @board without tripping on braces", () => {
    const p = parseScript(SCRIPT);
    const board = p.directives.find((d) => d.kind === "board");
    expect(board).toMatchObject({ kind: "board", id: "cosdef", itemKind: "katex", source: "x = \\cos\\theta" });
  });
});

describe("parseScript — escapes and edge cases", () => {
  it("strips double-bracket scene hints before parsing directives and narration", () => {
    const p = parseScript("Before. [[Move @camera freely.\nKeep the target visible.]] After @cue(theta = 1) now.");
    expect(p.narration).toBe("Before. After now.");
    expect(p.directives).toHaveLength(1);
    expect(p.narration.startsWith("now", p.directives[0]!.anchorOffset)).toBe(true);
  });

  it("reports an unterminated scene hint at its source location", () => {
    expect(() => parseScript("Before.\n[[Move the scene", "script.md")).toThrowError(
      new ParseError("unterminated scene hint", { file: "script.md", line: 2, col: 1 }),
    );
  });

  it("treats \\@ as a literal @ in narration", () => {
    const p = parseScript("Send an email \\@ me.");
    expect(p.narration).toBe("Send an email @ me.");
    expect(p.directives).toHaveLength(0);
  });
  it("leaves an unknown @name(...) as an 'unknown' directive for check to flag", () => {
    const p = parseScript("Words @wiggle(x) end.");
    expect(p.directives[0]).toMatchObject({ kind: "unknown", name: "wiggle" });
  });

  it("narrates a @pause prompt (spoken before the checkpoint), and speak:false opts out", () => {
    const spoken = parseScript('Before.\n\n@pause(prompt: "Try it yourself.")\n\nAfter.');
    expect(spoken.narration).toBe("Before.\n\nTry it yourself. After.");
    const silent = parseScript('Before.\n\n@pause(prompt: "Try it yourself.", speak: false)\n\nAfter.');
    expect(silent.narration).toBe("Before.\n\nAfter.");
    // The prompt metadata is parsed either way.
    expect(silent.directives.find((d) => d.kind === "pause")).toMatchObject({ prompt: "Try it yourself.", speak: false });
  });
});

describe("parseScript — @bake", () => {
  it("parses the baker name and timing options", () => {
    const parsed = parseScript("Start @bake(descent, steps: 3, over: 6s, ease: linear, at: +0.5s) end.");
    expect(parsed.directives[0]).toMatchObject({
      kind: "bake",
      name: "descent",
      options: { steps: 3, over: 6, ease: "linear", at: { kind: "delta", seconds: 0.5 } },
    });
    expect(parsed.narration).toBe("Start end.");
  });

  it("defaults to one step", () => {
    const parsed = parseScript("Start @bake(descent) end.");
    expect(parsed.directives[0]).toMatchObject({ kind: "bake", options: { steps: 1 } });
  });

  it("rejects a non-positive or fractional step count at the directive location", () => {
    for (const steps of ["0", "-1", "1.5", "many"]) {
      try {
        parseScript(`Start @bake(descent, steps: ${steps}) end.`, "script.md");
        expect.fail("expected ParseError");
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).message).toBe(`@bake steps must be a positive integer, got "${steps}"`);
        expect((error as ParseError).loc).toEqual({ file: "script.md", line: 1, col: 7 });
      }
    }
  });
});
