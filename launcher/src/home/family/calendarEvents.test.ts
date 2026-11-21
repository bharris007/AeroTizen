import { expect, test } from "vitest";

import type { TimedCalendarEvent } from "../../contracts/familyCalendar";

import { dayAgenda, eventTint } from "./calendarEvents";

const zone = "America/Chicago";
const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 21, hour + 6, minute); // CST, UTC-6
const event = (id: string, start: number, end: number): TimedCalendarEvent => ({
  allDay: false,
  calendarId: "c",
  color: "#4285f4",
  end,
  id,
  start,
  title: id,
});

test("pins events outside the 6:00–23:00 grid to its edges and keeps short events readable", () => {
  const agenda = dayAgenda(
    [event("early", at(5), at(5, 30)), event("late", at(23, 15), at(23, 45)), event("tiny", at(12), at(12))],
    at(9),
    zone,
  );
  const block = (id: string) => agenda.timed.find((item) => item.event.id === id)!;
  expect(block("early").top).toBe(0);
  expect(block("late").top + block("late").height).toBeCloseTo(1);
  expect(block("tiny").height).toBeCloseTo(30 / (17 * 60));
  expect(agenda.count).toBe(3);
});

test("gives three overlapping events their own columns and reuses a freed column", () => {
  const agenda = dayAgenda(
    [event("a", at(9), at(11)), event("b", at(9, 30), at(10)), event("c", at(10), at(10, 30))],
    at(9),
    zone,
  );
  expect(agenda.timed.map((block) => [block.event.id, block.column, block.columns])).toEqual([
    ["a", 0, 2],
    ["b", 1, 2],
    ["c", 1, 2],
  ]);
});

test("tints calendar colours", () => {
  expect(eventTint("#33b679", 0.3)).toBe("rgba(51, 182, 121, 0.3)");
});
