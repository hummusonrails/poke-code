import { describe, expect, it } from "vitest";
import { roll, rollWithSeed } from "../../src/companion/roll.js";
import { EYES, SPECIES } from "../../src/companion/types.js";

describe("roll", () => {
  it("returns consistent bones for the same userId", () => {
    const a = roll("user-abc");
    const b = roll("user-abc");
    expect(a.bones.species).toBe(b.bones.species);
    expect(a.bones.eye).toBe(b.bones.eye);
    expect(a.inspirationSeed).toBe(b.inspirationSeed);
  });

  it("returns different bones for different userIds", () => {
    const a = roll("user-one");
    const b = roll("user-two");
    // It's theoretically possible they match, but astronomically unlikely
    // for both species AND eye AND inspirationSeed to all match
    const same =
      a.bones.species === b.bones.species && a.bones.eye === b.bones.eye && a.inspirationSeed === b.inspirationSeed;
    expect(same).toBe(false);
  });

  it("result is cached (same reference on repeated calls)", () => {
    const a = roll("user-cached");
    const b = roll("user-cached");
    expect(a).toBe(b);
  });

  it("bones have valid species from SPECIES array", () => {
    const { bones } = roll("species-check");
    expect(SPECIES).toContain(bones.species);
  });

  it("bones have valid eye from EYES array", () => {
    const { bones } = roll("eye-check");
    expect(EYES).toContain(bones.eye);
  });

  it("inspirationSeed is a positive integer", () => {
    const { inspirationSeed } = roll("seed-check");
    expect(Number.isInteger(inspirationSeed)).toBe(true);
    expect(inspirationSeed).toBeGreaterThanOrEqual(0);
  });
});

describe("rollWithSeed", () => {
  it("returns consistent results for the same seed", () => {
    const a = rollWithSeed(12345);
    const b = rollWithSeed(12345);
    expect(a.bones.species).toBe(b.bones.species);
    expect(a.bones.eye).toBe(b.bones.eye);
    expect(a.inspirationSeed).toBe(b.inspirationSeed);
  });

  it("returns valid species and eye", () => {
    const { bones } = rollWithSeed(99999);
    expect(SPECIES).toContain(bones.species);
    expect(EYES).toContain(bones.eye);
  });

  it("inspirationSeed is a positive integer", () => {
    const { inspirationSeed } = rollWithSeed(42);
    expect(Number.isInteger(inspirationSeed)).toBe(true);
    expect(inspirationSeed).toBeGreaterThanOrEqual(0);
  });
});
