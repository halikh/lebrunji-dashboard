import { describe, expect, it } from "vitest";

import { nextChange, shopChange } from "./next-change";

const MON = 1;
const TUE = 2;
const SUN = 0;

const weekdays = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "09:00",
  closesAt: "22:00",
}));

describe("nextChange", () => {
  it("says when an open shop closes today", () => {
    expect(nextChange(weekdays, MON, "12:00")).toEqual({
      open: true,
      at: { dayOfWeek: MON, time: "22:00", daysAhead: 0 },
    });
  });

  it("says when a closed shop opens tomorrow", () => {
    expect(nextChange(weekdays, MON, "23:00")).toEqual({
      open: false,
      at: { dayOfWeek: TUE, time: "09:00", daysAhead: 1 },
    });
  });

  it("skips closed days, across the end of the week", () => {
    // Friday night: next open is Monday, three days on.
    expect(nextChange(weekdays, 5, "23:00").at).toEqual({
      dayOfWeek: MON,
      time: "09:00",
      daysAhead: 3,
    });
  });

  it("reads an overnight window's close on the next day", () => {
    const late = [{ dayOfWeek: MON, opensAt: "18:00", closesAt: "02:00" }];
    expect(nextChange(late, MON, "23:00")).toEqual({
      open: true,
      at: { dayOfWeek: TUE, time: "02:00", daysAhead: 1 },
    });
    expect(nextChange(late, TUE, "01:00")).toEqual({
      open: true,
      at: { dayOfWeek: TUE, time: "02:00", daysAhead: 0 },
    });
  });

  it("treats back-to-back shifts as one stretch", () => {
    const split = [
      { dayOfWeek: MON, opensAt: "07:00", closesAt: "15:00" },
      { dayOfWeek: MON, opensAt: "15:00", closesAt: "20:00" },
    ];
    expect(nextChange(split, MON, "10:00").at?.time).toBe("20:00");
  });

  it("finds the afternoon gap of a split day", () => {
    const split = [
      { dayOfWeek: MON, opensAt: "07:00", closesAt: "15:00" },
      { dayOfWeek: MON, opensAt: "19:00", closesAt: "01:00" },
    ];
    expect(nextChange(split, MON, "16:00")).toEqual({
      open: false,
      at: { dayOfWeek: MON, time: "19:00", daysAhead: 0 },
    });
  });

  it("has no next change for a week open around the clock", () => {
    expect(nextChange([], SUN, "10:00")).toEqual({ open: true, at: null });
    const allDay = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      opensAt: "00:00",
      closesAt: "00:00",
    }));
    expect(nextChange(allDay, TUE, "03:00")).toEqual({ open: true, at: null });
  });

  it("closes a single 24-hour day at the next midnight", () => {
    const monday = [{ dayOfWeek: MON, opensAt: "00:00", closesAt: "00:00" }];
    expect(nextChange(monday, MON, "08:00").at).toEqual({
      dayOfWeek: TUE,
      time: "00:00",
      daysAhead: 1,
    });
  });
});

describe("shopChange", () => {
  it("is open when any branch is, until the last one closes", () => {
    const rolled = shopChange([
      { open: true, at: { dayOfWeek: MON, time: "22:00", daysAhead: 0 } },
      { open: true, at: { dayOfWeek: MON, time: "23:30", daysAhead: 0 } },
      { open: false, at: { dayOfWeek: TUE, time: "09:00", daysAhead: 1 } },
    ]);
    expect(rolled.open).toBe(true);
    expect(rolled.openCount).toBe(2);
    expect(rolled.at?.time).toBe("23:30");
  });

  it("opens with the soonest branch when all are closed", () => {
    const rolled = shopChange([
      { open: false, at: { dayOfWeek: TUE, time: "10:00", daysAhead: 1 } },
      { open: false, at: { dayOfWeek: TUE, time: "08:00", daysAhead: 1 } },
    ]);
    expect(rolled).toMatchObject({ open: false, at: { time: "08:00" } });
  });
});
