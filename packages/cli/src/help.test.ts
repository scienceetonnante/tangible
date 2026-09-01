import { describe, expect, it } from "vitest";
import { helpText } from "./help.js";

describe("lesson help", () => {
  it("orients a first-time creator", () => {
    const help = helpText();
    expect(help).toContain("pnpm lesson new my-lesson");
    expect(help).toContain("docs/quickstart.md");
  });

  it("explains the credential-free preview modes", () => {
    const help = helpText("preview");
    expect(help).toContain("--silent");
    expect(help).toContain("--offline");
    expect(help).toContain("production voice");
  });

  it("rejects unknown topics", () => {
    expect(() => helpText("missing")).toThrow('unknown help topic "missing"');
  });
});
