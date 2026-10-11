import { describe, expect, it } from "vitest";

import { GRACE_MS, planSweep, type SweepObject } from "./sweep";

const NOW = new Date("2026-10-11T12:00:00Z");
const OLD = new Date(NOW.getTime() - GRACE_MS - 1);
const FRESH = new Date(NOW.getTime() - GRACE_MS + 60_000);

let next = 0;
function key(folder = "stores", extension = "jpg") {
  next += 1;
  return `${folder}/00000000-0000-4000-8000-${String(next).padStart(12, "0")}.${extension}`;
}

function object(name: string, lastModified = OLD, size = 100): SweepObject {
  return { key: name, size, lastModified };
}

describe("planSweep", () => {
  it("keeps what a row uses and removes what none does", () => {
    const used = key();
    const orphan = key("menu-items");
    const plan = planSweep({
      objects: [object(used), object(orphan, OLD, 250)],
      inUse: new Set([used]),
      now: NOW,
    });

    expect(plan).toEqual({
      ok: true,
      unused: [object(orphan, OLD, 250)],
      bytes: 250,
    });
  });

  it("leaves an upload younger than a day alone — its form may not be saved yet", () => {
    const used = key();
    const plan = planSweep({
      objects: [object(used), object(key(), FRESH)],
      inUse: new Set([used]),
      now: NOW,
    });

    expect(plan).toEqual({ ok: true, unused: [], bytes: 0 });
  });

  it("never touches an object in a shape an upload does not mint", () => {
    const used = key();
    const plan = planSweep({
      objects: [
        object(used),
        object("backups/catalogue.json"),
        object("stores/logo.png"),
        object("stores/nested/00000000-0000-4000-8000-000000000000.jpg"),
      ],
      inUse: new Set([used]),
      now: NOW,
    });

    expect(plan).toEqual({ ok: true, unused: [], bytes: 0 });
  });

  it("sweeps the pre-rename categories folder and sounds", () => {
    const used = key();
    const old = key("categories");
    const sound = key("sounds", "mp3");
    const plan = planSweep({
      objects: [object(used), object(old), object(sound)],
      inUse: new Set([used]),
      now: NOW,
    });

    expect(plan.ok && plan.unused.map((o) => o.key)).toEqual([old, sound]);
  });

  it("refuses when the database uses nothing but the bucket holds uploads", () => {
    const plan = planSweep({
      objects: [object(key())],
      inUse: new Set(),
      now: NOW,
    });

    expect(plan).toEqual({ ok: false, reason: "nothing-in-use" });
  });

  it("has nothing to do on an empty bucket and an empty database", () => {
    expect(planSweep({ objects: [], inUse: new Set(), now: NOW })).toEqual({
      ok: true,
      unused: [],
      bytes: 0,
    });
  });

  it("refuses when most keys in use are not in this bucket — another environment's", () => {
    const here = key();
    const plan = planSweep({
      objects: [object(here), object(key())],
      inUse: new Set([here, key(), key()]),
      now: NOW,
    });

    expect(plan).toEqual({ ok: false, reason: "mismatch" });
  });

  it("tolerates a few rows pointing at pictures that are gone", () => {
    const a = key();
    const b = key();
    const orphan = key();
    const plan = planSweep({
      objects: [object(a), object(b), object(orphan)],
      inUse: new Set([a, b, key()]),
      now: NOW,
    });

    expect(plan.ok && plan.unused.map((o) => o.key)).toEqual([orphan]);
  });
});
