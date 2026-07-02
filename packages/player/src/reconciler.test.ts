import { describe, it, expect, beforeEach } from "vitest";
import { buildIndex } from "@xv/core";
import type { Schema } from "@xv/core";
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
    rec.reconcile(SC, 1, 1, 0.016);
    expect(store.plain.xs).toBe(5);
    expect(store.plain.flag).toBe(true);
  });

  it("a dragged parameter shows the user value, ignoring scripted", () => {
    store.touch("xs", 42, 1, 1);
    store.setDragging("xs", true);
    rec.reconcile(SC, 1, 1, 0.016);
    expect(store.plain.xs).toBe(42);
  });
});

describe("Reconciler — ownership: script", () => {
  it("holds the user value during the hold window", () => {
    store.touch("xs", 42, 1, 1);
    rec.reconcile(SC, 1, 2, 0.016); // now=2, 1s after touch (< 3s hold)
    expect(store.plain.xs).toBe(42);
  });

  it("glides back to scripted after the hold and clears the modified flag", () => {
    store.touch("xs", 42, 1, 1);
    rec.reconcile(SC, 1, 2, 0.016); // in hold → 42 (prev becomes 42)
    // Past the hold: step frames until it reconverges.
    let now = 5;
    for (let i = 0; i < 2000 && store.meta.get("xs")!.modified; i++) {
      rec.reconcile(SC, 1, now, 0.016);
      now += 0.016;
    }
    expect(store.plain.xs).toBe(5);
    expect(store.meta.get("xs")!.modified).toBe(false);
  });

  it("reverts discrete parameters instantly at the end of the hold", () => {
    store.touch("flag", false, 1, 1);
    rec.reconcile({ ...SC, flag: true }, 1, 2, 0.016); // in hold → user value false
    expect(store.plain.flag).toBe(false);
    rec.reconcile({ ...SC, flag: true }, 1, 5, 0.016); // past hold → instant revert to scripted true
    expect(store.plain.flag).toBe(true);
    expect(store.meta.get("flag")!.modified).toBe(false);
  });
});

describe("Reconciler — ownership: viewer", () => {
  it("keeps the user value forever, ignoring scripted and the hold", () => {
    store.touch("xv", 42, 1, 1);
    rec.reconcile(SC, 1, 100, 0.016);
    expect(store.plain.xv).toBe(42);
    expect(store.meta.get("xv")!.modified).toBe(true);
  });
});

describe("Reconciler — ownership: shared", () => {
  it("holds until the script's next keyframe, then glides back", () => {
    store.touch("xsh", 42, 1, 1); // touchT = 1; next keyframe on xsh is t=10
    rec.reconcile({ ...SC, xsh: 5 }, 5, 2, 0.016); // t=5 < 10 → holds user value
    expect(store.plain.xsh).toBe(42);
    // At/after t=10 the script resumes; glide toward scripted.
    let now = 3;
    for (let i = 0; i < 2000 && store.meta.get("xsh")!.modified; i++) {
      rec.reconcile({ ...SC, xsh: 100 }, 10, now, 0.016);
      now += 0.016;
    }
    expect(store.plain.xsh).toBe(100);
  });
});

describe("Reconciler — seek", () => {
  it("reset() clears interaction so the display rejoins scripted", () => {
    store.touch("xv", 42, 1, 1); // even sticky viewer
    rec.reset();
    rec.reconcile(SC, 1, 1, 0.016);
    expect(store.plain.xv).toBe(5);
    expect(store.meta.get("xv")!.touchedEver).toBe(false);
  });
});
