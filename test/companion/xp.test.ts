import { describe, expect, it } from "vitest";
import { getNextMilestone, getStage, getUnlockedAccessories, grantXP } from "../../src/companion/xp.js";

describe("getStage", () => {
  it("returns spark for 0 XP", () => {
    expect(getStage(0)).toBe("spark");
  });

  it("returns spark for 99 XP", () => {
    expect(getStage(99)).toBe("spark");
  });

  it("returns powered for 100 XP", () => {
    expect(getStage(100)).toBe("powered");
  });

  it("returns powered for 499 XP", () => {
    expect(getStage(499)).toBe("powered");
  });

  it("returns overclocked for 500 XP", () => {
    expect(getStage(500)).toBe("overclocked");
  });

  it("returns overclocked for 9999 XP", () => {
    expect(getStage(9999)).toBe("overclocked");
  });
});

describe("getUnlockedAccessories", () => {
  it("returns empty array at 0 XP", () => {
    expect(getUnlockedAccessories(0)).toEqual([]);
  });

  it("returns signal-spark at 20 XP", () => {
    expect(getUnlockedAccessories(20)).toEqual(["signal-spark"]);
  });

  it("returns signal-spark and coral-crown at 50 XP", () => {
    expect(getUnlockedAccessories(50)).toEqual(["signal-spark", "coral-crown"]);
  });

  it("returns all accessories at 1000 XP", () => {
    const all = getUnlockedAccessories(1000);
    expect(all).toHaveLength(7);
    expect(all).toContain("signal-spark");
    expect(all).toContain("storm-aura");
  });

  it("returns correct accessories at 150 XP", () => {
    const acc = getUnlockedAccessories(150);
    expect(acc).toEqual(["signal-spark", "coral-crown", "tide-trail"]);
  });
});

describe("grantXP", () => {
  it("computes correct new XP for message_sent", () => {
    const result = grantXP(10, "message_sent");
    expect(result.xp).toBe(11);
  });

  it("computes correct new XP for session_start", () => {
    const result = grantXP(0, "session_start");
    expect(result.xp).toBe(5);
  });

  it("detects stage transition from spark to powered", () => {
    const result = grantXP(95, "session_start");
    expect(result.xp).toBe(100);
    expect(result.leveledUp).toBe(true);
    expect(result.newStage).toBe("powered");
  });

  it("detects stage transition from powered to overclocked", () => {
    const result = grantXP(495, "session_start");
    expect(result.xp).toBe(500);
    expect(result.leveledUp).toBe(true);
    expect(result.newStage).toBe("overclocked");
  });

  it("does not flag leveledUp when no stage change", () => {
    const result = grantXP(50, "message_sent");
    expect(result.leveledUp).toBe(false);
    expect(result.newStage).toBeUndefined();
  });

  it("detects new accessory unlocks", () => {
    const result = grantXP(19, "message_sent");
    expect(result.xp).toBe(20);
    expect(result.newAccessories).toEqual(["signal-spark"]);
  });

  it("returns empty newAccessories when none are unlocked", () => {
    const result = grantXP(25, "message_sent");
    expect(result.newAccessories).toEqual([]);
  });
});

describe("getNextMilestone", () => {
  it("returns signal-spark as first milestone at 0 XP", () => {
    const milestone = getNextMilestone(0);
    expect(milestone).not.toBeNull();
    expect(milestone!.name).toBe("signal-spark");
    expect(milestone!.type).toBe("accessory");
    expect(milestone!.xpNeeded).toBe(20);
  });

  it("returns correct next milestone at 45 XP", () => {
    const milestone = getNextMilestone(45);
    expect(milestone).not.toBeNull();
    expect(milestone!.name).toBe("coral-crown");
    expect(milestone!.xpNeeded).toBe(5);
  });

  it("returns stage milestone when it is closest", () => {
    const milestone = getNextMilestone(95);
    expect(milestone).not.toBeNull();
    expect(milestone!.type).toBe("stage");
    expect(milestone!.name).toBe("powered");
    expect(milestone!.xpNeeded).toBe(5);
  });

  it("returns null when all milestones reached", () => {
    const milestone = getNextMilestone(2000);
    expect(milestone).toBeNull();
  });
});
