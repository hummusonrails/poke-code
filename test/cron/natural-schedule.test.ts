import { describe, expect, it } from "vitest";
import { parseNaturalSchedule } from "../../src/cron/natural-schedule.js";

describe("parseNaturalSchedule", () => {
  it("parses 'every 30 minutes'", () => {
    const result = parseNaturalSchedule("every 30 minutes");
    expect(result).toEqual({ cron: "*/30 * * * *", oneShot: false });
  });

  it("parses 'every 2 hours'", () => {
    const result = parseNaturalSchedule("every 2 hours");
    expect(result).toEqual({ cron: "0 */2 * * *", oneShot: false });
  });

  it("parses 'every day at 9am'", () => {
    const result = parseNaturalSchedule("every day at 9am");
    expect(result).toEqual({ cron: "0 9 * * *", oneShot: false });
  });

  it("parses 'every day at 5pm'", () => {
    const result = parseNaturalSchedule("every day at 5pm");
    expect(result).toEqual({ cron: "0 17 * * *", oneShot: false });
  });

  it("parses 'every weekday at 5pm'", () => {
    const result = parseNaturalSchedule("every weekday at 5pm");
    expect(result).toEqual({ cron: "0 17 * * 1-5", oneShot: false });
  });

  it("parses 'every monday'", () => {
    const result = parseNaturalSchedule("every monday");
    expect(result).toEqual({ cron: "0 9 * * 1", oneShot: false });
  });

  it("parses 'every friday at 3pm'", () => {
    const result = parseNaturalSchedule("every friday at 3pm");
    expect(result).toEqual({ cron: "0 15 * * 5", oneShot: false });
  });

  it("parses 'at midnight'", () => {
    const result = parseNaturalSchedule("at midnight");
    expect(result).toEqual({ cron: "0 0 * * *", oneShot: false });
  });

  it("parses 'at noon'", () => {
    const result = parseNaturalSchedule("at noon");
    expect(result).toEqual({ cron: "0 12 * * *", oneShot: false });
  });

  it("parses 'every hour'", () => {
    const result = parseNaturalSchedule("every hour");
    expect(result).toEqual({ cron: "0 * * * *", oneShot: false });
  });

  it("parses 'every minute'", () => {
    const result = parseNaturalSchedule("every minute");
    expect(result).toEqual({ cron: "* * * * *", oneShot: false });
  });

  it("returns null for unrecognized input", () => {
    const result = parseNaturalSchedule("whenever you feel like it");
    expect(result).toBeNull();
  });

  it("parses 'once at 3pm' as one-shot", () => {
    const result = parseNaturalSchedule("once at 3pm");
    expect(result?.oneShot).toBe(true);
    expect(result?.cron).toBe("0 15 * * *");
  });

  it("parses 'in 2 hours' as one-shot", () => {
    const result = parseNaturalSchedule("in 2 hours");
    expect(result?.oneShot).toBe(true);
    expect(result?.cron).toMatch(/^\d+ \d+ \* \* \*$/);
  });
});
