import { describe, expect, it } from "vitest";
import { renderFace, renderSprite, spriteFrameCount } from "../../src/companion/sprites.js";
import type { Species, Stage } from "../../src/companion/types.js";
import { SPECIES, STAGES } from "../../src/companion/types.js";

describe("renderSprite", () => {
  it("returns 5 lines for every species/stage combo", () => {
    for (const species of SPECIES) {
      for (const stage of STAGES) {
        const lines = renderSprite(species, stage, "·");
        expect(lines).toHaveLength(5);
      }
    }
  });

  it("replaces {E} with the given eye character", () => {
    for (const species of SPECIES) {
      const lines = renderSprite(species, "spark", "✦");
      const joined = lines.join("\n");
      expect(joined).not.toContain("{E}");
      expect(joined).toContain("✦");
    }
  });

  it("applies accessory overlay to hat slot when blank", () => {
    // Frame 0 hat slot is blank for all species/spark combos
    const lines = renderSprite("clicklaw", "spark", "·", 0, ["coral-crown"]);
    expect(lines[0].trim()).not.toBe("");
    expect(lines[0]).toContain("^^^");
  });

  it("does not replace hat slot when already occupied (frame 2)", () => {
    // Frame 2 typically has effects in the hat slot
    const linesWithout = renderSprite("clicklaw", "spark", "·", 2);
    const linesWith = renderSprite("clicklaw", "spark", "·", 2, ["coral-crown"]);
    // Hat slot is not blank in frame 2, so accessory should not replace it
    expect(linesWith[0]).toBe(linesWithout[0]);
  });

  it("appends tide-trail to line 4", () => {
    const lines = renderSprite("clicklaw", "spark", "·", 0, ["tide-trail"]);
    expect(lines[4]).toMatch(/~$/);
  });
});

describe("renderFace", () => {
  it("returns a non-empty string for every species", () => {
    for (const species of SPECIES) {
      const face = renderFace(species, "·");
      expect(face.length).toBeGreaterThan(0);
      expect(face).not.toContain("{E}");
    }
  });
});

describe("spriteFrameCount", () => {
  it("returns 3 for every species/stage", () => {
    for (const species of SPECIES) {
      for (const stage of STAGES) {
        expect(spriteFrameCount(species, stage)).toBe(3);
      }
    }
  });
});
