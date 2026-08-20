import { describe, it, expect, beforeEach } from "vitest";
import { buildIndex } from "@narrable/core";
import type { Schema } from "@narrable/core";
import { StateStore } from "./store.js";
import { Reconciler } from "./reconciler.js";

const schema: Schema = {
  xs: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
  xv: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "viewer" },
  xsh: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "shared" },
  flag: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};
const tracks = { xsh: [{ t: 0, v: 0 }, { t: 10, v: 100 }] };

let store: StateStore;
let rec: Reconciler;
beforeEach(() => {
  store = new StateStore(schema);
  rec = new Reconciler(store, buildIndex(tracks, schema), schema, { hold: 3, tau: 0.2 });
});

const SC = { xs: 5, xv: 5, xsh: 5, flag: true };

describe("Reconciler — untouched and dragging", () => {
  it("untouched parameters show the scripted value", () => {
    rec.reconcile(SC, 1, 0.016);
    expect(store.plain.xs).toBe(5);
    expect(store.plain.flag).toBe(true);
  });

  it("a dragged parameter shows the user value, ignoring scripted", () => {
    store.touch("xs", 42, 1);
    store.setDragging("xs", true);
    rec.reconcile(SC, 1, 0.016);
    expect(store.plain.xs).toBe(42);
  });
});

describe("Reconciler — ownership: script", () => {
  it("holds the user value during the hold window", () => {
    store.touch("xs", 42, 1);
    rec.reconcile(SC, 2, 0.016); // 1s of playback after touch (< 3s hold)
    expect(store.plain.xs).toBe(42);
  });

  it("glides back to scripted after the hold and clears the modified flag", () => {
    store.touch("xs", 42, 1);
    rec.reconcile(SC, 2, 0.016); // in hold → 42 (prev becomes 42)
    // Past the hold: step frames until it reconverges.
    let t = 5;
    for (let i = 0; i < 2000 && store.meta.get("xs")!.modified; i++) {
      rec.reconcile(SC, t, 0.016);
      t += 0.016;
    }
    expect(store.plain.xs).toBe(5);
    expect(store.meta.get("xs")!.modified).toBe(false);
  });

  it("reverts discrete parameters instantly at the end of the hold", () => {
    store.touch("flag", false, 1);
    rec.reconcile({ ...SC, flag: true }, 2, 0.016); // in hold → user value false
    expect(store.plain.flag).toBe(false);
    rec.reconcile({ ...SC, flag: true }, 5, 0.016); // past hold → instant revert to scripted true
    expect(store.plain.flag).toBe(true);
    expect(store.meta.get("flag")!.modified).toBe(false);
  });
});

describe("Reconciler — ownership: viewer", () => {
  it("keeps the user value forever, ignoring scripted and the hold", () => {
    store.touch("xv", 42, 1);
    rec.reconcile(SC, 100, 0.016);
    expect(store.plain.xv).toBe(42);
    expect(store.meta.get("xv")!.modified).toBe(true);
  });
});

describe("Reconciler — ownership: shared", () => {
  it("holds until the script's next keyframe, then glides back", () => {
    store.touch("xsh", 42, 1); // touchT = 1; next keyframe on xsh is t=10
    rec.reconcile({ ...SC, xsh: 5 }, 5, 0.016); // t=5 < 10 → holds user value
    expect(store.plain.xsh).toBe(42);
    // At/after t=10 the script resumes; glide toward scripted.
    let t = 10;
    for (let i = 0; i < 2000 && store.meta.get("xsh")!.modified; i++) {
      rec.reconcile({ ...SC, xsh: 100 }, t, 0.016);
      t += 0.016;
    }
    expect(store.plain.xsh).toBe(100);
  });
});

describe("Reconciler — seek", () => {
  it("reset() clears interaction so the display rejoins scripted", () => {
    store.touch("xv", 42, 1); // even sticky viewer
    rec.reset();
    rec.reconcile(SC, 1, 0.016);
    expect(store.plain.xv).toBe(5);
    expect(store.meta.get("xv")!.touchedEver).toBe(false);
  });
});

describe("Reconciler — pause and resume", () => {
  it("freezes continuous and discrete learner values for the whole pause", () => {
    store.touch("xs", 42, 1);
    rec.reconcile(SC, 5, 0.016); // the scalar has started returning to the script
    const frozen = store.plain.xs;

    rec.freeze(5);
    store.touch("flag", false, 5); // a new edit made after pausing
    rec.reconcile(SC, 5, 30, false); // wall time is irrelevant while paused

    expect(store.plain.xs).toBe(frozen);
    expect(store.plain.flag).toBe(false);
    expect(store.meta.get("xs")!.modified).toBe(true);
    expect(store.meta.get("flag")!.modified).toBe(true);
  });

  it("holds a paused learner edit for three fresh seconds of playback after resume", () => {
    store.touch("xs", 42, 5);
    store.touch("flag", false, 5);
    rec.reconcile(SC, 5, 30, false);
    rec.resume(5);

    rec.reconcile(SC, 7.99, 0.016, true);
    expect(store.plain.xs).toBe(42);
    expect(store.plain.flag).toBe(false);

    rec.reconcile(SC, 8, 0.016, true);
    expect(store.plain.xs).toBeLessThan(42);
    expect(store.plain.flag).toBe(true);
  });
});
