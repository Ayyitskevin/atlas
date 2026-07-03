import { describe, expect, it } from "vitest";

import { nextRecurringDueDate } from "../../src/modules/work/task-recurrence.js";

describe("task recurrence", () => {
  it("advances daily and weekly due dates", () => {
    expect(nextRecurringDueDate({ dueDate: "2026-07-03", frequency: "DAILY", interval: 1 })).toBe("2026-07-04");
    expect(nextRecurringDueDate({ dueDate: "2026-07-03", frequency: "WEEKLY", interval: 2 })).toBe("2026-07-17");
  });

  it("clamps monthly due dates to the target month length", () => {
    expect(nextRecurringDueDate({ dueDate: "2026-01-31", frequency: "MONTHLY", interval: 1 })).toBe("2026-02-28");
  });

  it("uses the current UTC date for unscheduled recurring tasks", () => {
    expect(
      nextRecurringDueDate(
        { dueDate: null, frequency: "DAILY", interval: 3 },
        new Date("2026-07-03T20:30:00.000Z"),
      ),
    ).toBe("2026-07-06");
  });
});
