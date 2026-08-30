import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatTime,
  fromWallClock,
  isSameBusinessDay,
  startOfBusinessDay,
  startOfBusinessDayPlus,
  toWallClock,
} from "./time";

/**
 * These run against Beirut, whatever timezone the machine is in — which is the
 * property being tested. If any of these start depending on where the test runs,
 * the module has stopped doing its job.
 *
 * Beirut is UTC+2 in winter and UTC+3 in summer, switching on the last Sunday of
 * March and October. In 2026 that is 29 March and 25 October.
 */
describe("toWallClock", () => {
  it("reads winter as UTC+2", () => {
    expect(toWallClock(new Date("2026-01-15T12:00:00Z"))).toMatchObject({
      year: 2026,
      month: 1,
      day: 15,
      hour: 14,
    });
  });

  it("reads summer as UTC+3", () => {
    expect(toWallClock(new Date("2026-07-15T12:00:00Z"))).toMatchObject({
      month: 7,
      day: 15,
      hour: 15,
    });
  });

  it("reports midnight as hour 0, never 24", () => {
    // Some engines render midnight as `24` under `hour12: false`, which would
    // make the start of a day look like the end of the previous one — and that
    // is the exact value the day boundary is built on.
    expect(toWallClock(new Date("2026-01-14T22:00:00Z")).hour).toBe(0);
    expect(toWallClock(new Date("2026-01-14T22:00:00Z")).day).toBe(15);
  });

  it("rolls the date over at Beirut midnight, not UTC midnight", () => {
    // 22:30 UTC is already tomorrow in Beirut. An order placed here belongs to
    // the next day's takings, and a UTC boundary would file it in the wrong one.
    expect(toWallClock(new Date("2026-01-14T22:30:00Z"))).toMatchObject({
      day: 15,
      hour: 0,
      minute: 30,
    });
  });
});

describe("fromWallClock", () => {
  it("round-trips through toWallClock in winter", () => {
    const instant = fromWallClock({
      year: 2026,
      month: 1,
      day: 15,
      hour: 9,
      minute: 30,
    });
    expect(instant.toISOString()).toBe("2026-01-15T07:30:00.000Z");
    expect(toWallClock(instant)).toMatchObject({
      day: 15,
      hour: 9,
      minute: 30,
    });
  });

  it("round-trips in summer", () => {
    const instant = fromWallClock({
      year: 2026,
      month: 7,
      day: 15,
      hour: 9,
      minute: 30,
    });
    expect(instant.toISOString()).toBe("2026-07-15T06:30:00.000Z");
  });

  it("defaults to midnight when no time is given", () => {
    // Midnight on the 15th in Beirut is 22:00 on the *14th* in UTC. Reading
    // that as the 15th is the mistake this whole module exists to stop, and it
    // is worth pinning that the answer is the earlier calendar date.
    expect(fromWallClock({ year: 2026, month: 1, day: 15 }).toISOString()).toBe(
      "2026-01-14T22:00:00.000Z",
    );
  });

  /**
   * The two hours a year a fixed offset would be wrong.
   *
   * These are the whole reason the offset is looked up per instant rather than
   * written down as a constant: a hardcoded +2 or +3 passes every other test in
   * this file and is silently an hour out for half the year.
   */
  describe("around the DST changes", () => {
    it("is UTC+2 the day before spring forward", () => {
      expect(
        fromWallClock({
          year: 2026,
          month: 3,
          day: 28,
          hour: 12,
        }).toISOString(),
      ).toBe("2026-03-28T10:00:00.000Z");
    });

    it("is UTC+3 the day after spring forward", () => {
      expect(
        fromWallClock({
          year: 2026,
          month: 3,
          day: 30,
          hour: 12,
        }).toISOString(),
      ).toBe("2026-03-30T09:00:00.000Z");
    });

    it("is UTC+3 the day before autumn back", () => {
      expect(
        fromWallClock({
          year: 2026,
          month: 10,
          day: 24,
          hour: 12,
        }).toISOString(),
      ).toBe("2026-10-24T09:00:00.000Z");
    });

    it("is UTC+2 the day after autumn back", () => {
      expect(
        fromWallClock({
          year: 2026,
          month: 10,
          day: 26,
          hour: 12,
        }).toISOString(),
      ).toBe("2026-10-26T10:00:00.000Z");
    });

    it("gives the spring-forward day a midnight that exists", () => {
      // 00:00 on the change day is before the 02:00 jump, so it is still +2.
      // The naive single-pass conversion picks +3 here and lands an hour early
      // — which would put an hour of the previous day into this one.
      expect(
        fromWallClock({ year: 2026, month: 3, day: 29 }).toISOString(),
      ).toBe("2026-03-28T22:00:00.000Z");
    });
  });
});

describe("startOfBusinessDay", () => {
  it("is Beirut midnight for the day containing the instant", () => {
    const midMorning = new Date("2026-01-15T09:00:00Z");
    expect(startOfBusinessDay(midMorning).toISOString()).toBe(
      "2026-01-14T22:00:00.000Z",
    );
  });

  it("treats 00:30 Beirut as the start of that day, not the end of the last", () => {
    // A shop closing at 01:00. Its final orders must land in the day that has
    // just begun, which is what the operator will be looking at in the morning.
    const lateTrade = new Date("2026-01-14T22:30:00Z");
    expect(startOfBusinessDay(lateTrade).toISOString()).toBe(
      "2026-01-14T22:00:00.000Z",
    );
    expect(toWallClock(lateTrade).day).toBe(15);
  });

  it("shifts with the season", () => {
    expect(
      startOfBusinessDay(new Date("2026-07-15T09:00:00Z")).toISOString(),
    ).toBe("2026-07-14T21:00:00.000Z");
  });
});

describe("startOfBusinessDayPlus", () => {
  it("rolls over a month end", () => {
    // `day + 1` on the 31st is not the 32nd, which is why this goes through
    // Date.UTC rather than incrementing the number.
    const lastOfJanuary = new Date("2026-01-31T12:00:00Z");
    expect(toWallClock(startOfBusinessDayPlus(1, lastOfJanuary))).toMatchObject(
      {
        month: 2,
        day: 1,
      },
    );
  });

  it("goes backwards", () => {
    const firstOfMarch = new Date("2026-03-01T12:00:00Z");
    expect(toWallClock(startOfBusinessDayPlus(-1, firstOfMarch))).toMatchObject(
      {
        month: 2,
        day: 28,
      },
    );
  });
});

describe("isSameBusinessDay", () => {
  it("is true across a UTC midnight that is not a Beirut one", () => {
    // 23:00 on the 15th UTC and 01:00 on the 16th UTC are both 16 January in
    // Beirut (01:00 and 03:00), spanning UTC's own boundary. A comparison done
    // in UTC would call these different days.
    expect(
      isSameBusinessDay(
        new Date("2026-01-15T23:00:00Z"),
        new Date("2026-01-16T01:00:00Z"),
      ),
    ).toBe(true);
  });

  it("is false across a Beirut midnight that is not a UTC one", () => {
    expect(
      isSameBusinessDay(
        new Date("2026-01-15T21:30:00Z"),
        new Date("2026-01-15T22:30:00Z"),
      ),
    ).toBe(false);
  });
});

describe("formatting", () => {
  it("shows the Beirut clock, not the machine’s", () => {
    expect(formatTime("2026-01-15T12:00:00Z")).toBe("14:00");
    expect(formatTime("2026-07-15T12:00:00Z")).toBe("15:00");
  });

  it("shows the Beirut date", () => {
    // 22:30 UTC is already the 15th in Beirut.
    expect(formatDate("2026-01-14T22:30:00Z")).toBe("15 Jan 2026");
  });
});
