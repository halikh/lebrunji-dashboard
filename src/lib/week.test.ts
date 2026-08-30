import { describe, expect, it } from "vitest";

import { isOpenAt, summarise, type DayWindow } from "./week";

/** Monday first, as the dashboard reads a week. */
const READING_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const day = (
  dayOfWeek: number,
  opensAt: string,
  closesAt: string,
): DayWindow => ({
  dayOfWeek,
  opensAt,
  closesAt,
});

describe("isOpenAt", () => {
  const week = [
    day(1, "11:00", "23:00"),
    day(2, "11:00", "23:00"),
    day(5, "18:00", "02:00"),
  ];

  it("is open inside an ordinary window", () => {
    expect(isOpenAt(week, 1, "12:00")).toBe(true);
  });

  it("is closed before it opens and after it shuts", () => {
    expect(isOpenAt(week, 1, "10:59")).toBe(false);
    expect(isOpenAt(week, 1, "23:00")).toBe(false);
  });

  it("is closed on a day with no window at all", () => {
    // A missing row is the shop being shut, not missing data.
    expect(isOpenAt(week, 3, "12:00")).toBe(false);
  });

  it("stays open past midnight on an overnight day", () => {
    expect(isOpenAt(week, 5, "23:30")).toBe(true);
  });

  it("counts the small hours as the previous day's window", () => {
    // The one that matters. Half past midnight on Saturday is inside *Friday's*
    // 18:00–02:00. Asking only about Saturday reports a busy kitchen as closed —
    // for two hours a night, at the busiest end of the evening, with a timetable
    // on screen that looks perfectly correct.
    expect(isOpenAt(week, 6, "00:30")).toBe(true);
    expect(isOpenAt(week, 6, "02:00")).toBe(false);
  });

  it("does not let an ordinary window spill into the next day", () => {
    // Tuesday closes at 23:00, so Wednesday morning is shut — the spillover
    // rule must apply to overnight windows only.
    expect(isOpenAt(week, 3, "00:30")).toBe(false);
  });

  it("treats an unreadable time as closed rather than guessing", () => {
    expect(isOpenAt([day(1, "", "")], 1, "12:00")).toBe(false);
    expect(isOpenAt(week, 1, "noon")).toBe(false);
  });
});

describe("summarise", () => {
  it("joins consecutive days with identical hours", () => {
    const week = READING_ORDER.map((d) => day(d, "11:00", "23:00"));
    expect(summarise(week, READING_ORDER)).toEqual([
      { open: true, from: 1, to: 0, opensAt: "11:00", closesAt: "23:00" },
    ]);
  });

  it("keeps days apart when the hours differ at all", () => {
    // Half an hour on a Friday is exactly what somebody is checking for.
    const week = [
      ...[1, 2, 3, 4].map((d) => day(d, "11:00", "23:00")),
      ...[5, 6].map((d) => day(d, "11:00", "23:59")),
    ];
    expect(summarise(week, READING_ORDER)).toEqual([
      { open: true, from: 1, to: 4, opensAt: "11:00", closesAt: "23:00" },
      { open: true, from: 5, to: 6, opensAt: "11:00", closesAt: "23:59" },
      { open: false, from: 0, to: 0 },
    ]);
  });

  it("groups in the order given, not in the stored order", () => {
    // Sunday is 0 and is read last. Grouping against the stored order would
    // produce "Sun, Mon–Sat" for a shop that simply opens every day — correct,
    // and unreadable.
    const week = READING_ORDER.map((d) => day(d, "09:00", "17:00"));
    const spans = summarise(week, READING_ORDER);
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ from: 1, to: 0 });
  });

  it("runs closed days together too", () => {
    const week = [day(1, "11:00", "23:00")];
    expect(summarise(week, READING_ORDER)).toEqual([
      { open: true, from: 1, to: 1, opensAt: "11:00", closesAt: "23:00" },
      { open: false, from: 2, to: 0 },
    ]);
  });

  it("reports a week with nothing set as one closed run", () => {
    expect(summarise([], READING_ORDER)).toEqual([
      { open: false, from: 1, to: 0 },
    ]);
  });
});
