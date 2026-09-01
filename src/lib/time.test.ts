import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatTime,
  fromWallClock,
  isSameBusinessDay,
  startOfBusinessDay,
  startOfBusinessDayPlus,
  toWallClock,
  businessMonthKey,
  businessWeekday,
  recentMonthKeys,
  formatMonthKey,
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
  it("is 08:00 Beirut on the day of the shift, not midnight", () => {
    // 11:00 Beirut in winter (UTC+2), so the shift began three hours earlier.
    const midMorning = new Date("2026-01-15T09:00:00Z");
    expect(startOfBusinessDay(midMorning).toISOString()).toBe(
      "2026-01-15T06:00:00.000Z",
    );
  });

  it("puts a late-night order in the shift that has not finished", () => {
    // 00:30 on the 15th in Beirut. The kitchen closes at 02:00, so this belongs
    // to the *14th's* trade — filing it under the 15th is what split every late
    // night across two days.
    const lateTrade = new Date("2026-01-14T22:30:00Z");
    expect(toWallClock(lateTrade).day).toBe(15);
    expect(startOfBusinessDay(lateTrade).toISOString()).toBe(
      "2026-01-14T06:00:00.000Z",
    );
  });

  it("starts the new shift at 08:00, not before", () => {
    // 07:59 Beirut is still yesterday's shift; 08:00 is today's.
    expect(
      startOfBusinessDay(new Date("2026-01-15T05:59:00Z")).toISOString(),
    ).toBe("2026-01-14T06:00:00.000Z");
    expect(
      startOfBusinessDay(new Date("2026-01-15T06:00:00Z")).toISOString(),
    ).toBe("2026-01-15T06:00:00.000Z");
  });

  it("shifts with the season", () => {
    // Summer is UTC+3, so 08:00 Beirut is 05:00Z rather than 06:00Z.
    expect(
      startOfBusinessDay(new Date("2026-07-15T09:00:00Z")).toISOString(),
    ).toBe("2026-07-15T05:00:00.000Z");
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

  it("keeps a night together across midnight", () => {
    // 23:30 and 00:30 in Beirut — either side of the calendar boundary, and
    // the same shift. This is the whole reason the boundary is 08:00.
    expect(
      isSameBusinessDay(
        new Date("2026-01-15T21:30:00Z"),
        new Date("2026-01-15T22:30:00Z"),
      ),
    ).toBe(true);
  });

  it("is false across the 08:00 boundary", () => {
    // 07:30 and 08:30 Beirut on the same date: two shifts, one date.
    expect(
      isSameBusinessDay(
        new Date("2026-01-15T05:30:00Z"),
        new Date("2026-01-15T06:30:00Z"),
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

/**
 * Bucketing an order into a month or a weekday.
 *
 * These are the shape of thing that is correct for ten months and quietly an
 * hour — or a whole day — out for the other two: an order placed just after
 * Beirut midnight belongs to *this* day, and the machine's zone would file it
 * under the previous one. That failure is invisible on a laptop set to Beirut,
 * which is the only laptop anybody tests on.
 */
describe("businessMonthKey", () => {
  it("counts a late night towards the month whose evening it was", () => {
    // 31 Aug 22:30 UTC is 01:30 on 1 September in Beirut — and it is the 31st's
    // trade, because the shift began on the 31st and has not ended.
    expect(businessMonthKey("2026-08-31T22:30:00Z")).toBe("2026-08");
  });

  it("keeps a mid-month instant in its own month", () => {
    expect(businessMonthKey("2026-08-15T09:00:00Z")).toBe("2026-08");
  });

  it("pads the month, so the keys sort as strings", () => {
    expect(businessMonthKey("2026-01-15T09:00:00Z")).toBe("2026-01");
  });

  it("crosses the year on the shift, not on the clock", () => {
    // 00:30 on 1 January in Beirut is still New Year's Eve trade.
    expect(businessMonthKey("2026-12-31T22:30:00Z")).toBe("2026-12");
    // 09:00 on 1 January is the new year's first shift.
    expect(businessMonthKey("2027-01-01T07:00:00Z")).toBe("2027-01");
  });
});

describe("businessWeekday", () => {
  it("is Sunday-zero, matching the stored day_of_week", () => {
    // 30 August 2026 is a Sunday.
    expect(businessWeekday("2026-08-30T09:00:00Z")).toBe(0);
  });

  it("puts a late-night order on the night it belongs to", () => {
    // Friday 21:30 UTC is Saturday 00:30 in Beirut — and it is Friday night's
    // trade. A "when are we busy" chart that put it on Saturday would move the
    // busiest hours of the week onto the wrong bar.
    expect(businessWeekday("2026-08-28T21:30:00Z")).toBe(5);
  });

  it("does not shift an ordinary daytime instant", () => {
    // Monday 31 August 2026, midday.
    expect(businessWeekday("2026-08-31T09:00:00Z")).toBe(1);
  });
});

describe("recentMonthKeys", () => {
  it("walks months rather than subtracting days", () => {
    // Twelve 30-day steps back from March would land in the wrong month by the
    // fifth one. Stepping the month never does.
    const keys = recentMonthKeys(4, new Date("2026-03-15T09:00:00Z"));
    expect(keys).toEqual(["2025-12", "2026-01", "2026-02", "2026-03"]);
  });

  it("ends on the current Beirut month, oldest first", () => {
    const keys = recentMonthKeys(12, new Date("2026-08-31T09:00:00Z"));
    expect(keys).toHaveLength(12);
    expect(keys[11]).toBe("2026-08");
    expect(keys[0]).toBe("2025-09");
  });

  it("uses the shift's month at the boundary", () => {
    // 01:30 on 1 September in Beirut, which is still the 31st's shift.
    const keys = recentMonthKeys(1, new Date("2026-08-31T22:30:00Z"));
    expect(keys).toEqual(["2026-08"]);
  });
});

describe("formatMonthKey", () => {
  it("renders a key as a short label", () => {
    expect(formatMonthKey("2026-08")).toBe("Aug 26");
  });

  it("survives a key it does not recognise rather than rendering undefined", () => {
    expect(formatMonthKey("2026-13")).toBe("13 26");
  });
});
