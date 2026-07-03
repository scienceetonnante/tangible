import { describe, it, expect } from "vitest";
import { buildIndex } from "@narrable/core";
import type { Schema } from "@narrable/core";
import { AudioClock, type MediaClockSource } from "./clock.js";
import { StateStore } from "./store.js";
import { TimelineDriver } from "./timeline.js";

// Controllable media stub.
class FakeMedia implements MediaClockSource {
  currentTime = 0;
  paused = true;
  duration = 20;
  play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
}

const schema: Schema = {
  x: { type: { kind: "scalar" }, default: 0, interpolate: "lerp", ownership: "script" },
  flag: { type: { kind: "boolean" }, default: false, interpolate: "snap", ownership: "script" },
};
const tracks = {
  x: [{ t: 0, v: 0 }, { t: 10, v: 100, ease: "linear" }],
  flag: [{ t: 0, v: false }, { t: 5, v: true }],
};

function setup() {
  const media = new FakeMedia();
  const clock = new AudioClock(media);
  const store = new StateStore(schema);
  const seeks: number[] = [];
  const driver = new TimelineDriver(clock, buildIndex(tracks, schema), store, { onSeek: (t) => seeks.push(t) });
  return { media, clock, store, driver, seeks };
}

describe("AudioClock", () => {
  it("rounds time to 10ms and reflects play/pause", () => {
    const media = new FakeMedia();
    const clock = new AudioClock(media);
    media.currentTime = 1.23456;
    expect(clock.t).toBe(1.23);
    expect(clock.playing).toBe(false);
    clock.play();
    expect(clock.playing).toBe(true);
    clock.seek(-5);
    expect(media.currentTime).toBe(0); // clamps to 0
  });
});

describe("TimelineDriver.tick", () => {
  it("writes scripted state into the store at the current time", () => {
    const { media, store, driver } = setup();
    media.currentTime = 5;
    driver.tick();
    expect(store.plain.x).toBeCloseTo(50, 9);
    expect(store.plain.flag).toBe(true);
  });

  it("detects a seek (jump > 0.25s between frames)", () => {
    const { media, driver, seeks } = setup();
    media.currentTime = 0.1;
    driver.tick();
    media.currentTime = 8; // big jump
    driver.tick();
    expect(seeks).toEqual([8]);
  });

  it("does not flag normal frame-to-frame advance as a seek", () => {
    const { media, driver, seeks } = setup();
    media.paused = false;
    for (let i = 0; i < 5; i++) {
      media.currentTime = i * 0.016;
      driver.tick();
    }
    expect(seeks).toEqual([]);
  });
});

describe("StateStore", () => {
  it("updates the signal only on actual change", () => {
    const store = new StateStore(schema);
    let notifications = 0;
    store.signal("x").subscribe(() => notifications++); // fires once on subscribe
    store.set("x", 5);
    store.set("x", 5); // no change → no new notification
    store.set("x", 7);
    expect(notifications).toBe(3); // subscribe + two real changes
  });

  it("keeps the plain mirror self-owned (reuses array slots)", () => {
    const vecSchema: Schema = { v: { type: { kind: "vec3" }, default: [0, 0, 0], interpolate: "lerp", ownership: "script" } };
    const store = new StateStore(vecSchema);
    const ref = store.plain.v;
    store.set("v", [1, 2, 3]);
    expect(store.plain.v).toBe(ref); // wrote into the existing array
    expect(store.plain.v).toEqual([1, 2, 3]);
  });
});
