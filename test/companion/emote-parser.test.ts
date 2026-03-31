import { describe, expect, it } from "vitest";
import { parseEmotes, extractEmotes, actionToAnimation } from "../../src/companion/emote-parser.js";

describe("parseEmotes", () => {
  it("extracts emote blocks correctly", () => {
    const text = 'Here is text [emote]bounces excitedly "Hello!"[/emote] and more.';
    const emotes = parseEmotes(text);
    expect(emotes).toHaveLength(1);
    expect(emotes[0].raw).toBe('[emote]bounces excitedly "Hello!"[/emote]');
  });

  it("separates action and speech", () => {
    const text = '[emote]wiggles happily "Great job!"[/emote]';
    const emotes = parseEmotes(text);
    expect(emotes).toHaveLength(1);
    expect(emotes[0].action).toBe("wiggles happily");
    expect(emotes[0].speech).toBe("Great job!");
  });

  it("handles emotes with only action (no speech)", () => {
    const text = "[emote]shivers nervously[/emote]";
    const emotes = parseEmotes(text);
    expect(emotes).toHaveLength(1);
    expect(emotes[0].action).toBe("shivers nervously");
    expect(emotes[0].speech).toBeUndefined();
  });

  it("handles multiple emotes", () => {
    const text = '[emote]bounces "Hi!"[/emote] some text [emote]yawns sleepily[/emote]';
    const emotes = parseEmotes(text);
    expect(emotes).toHaveLength(2);
    expect(emotes[0].speech).toBe("Hi!");
    expect(emotes[1].action).toBe("yawns sleepily");
  });

  it("returns empty array for text without emotes", () => {
    const emotes = parseEmotes("just some regular text with no emote blocks");
    expect(emotes).toEqual([]);
  });
});

describe("extractEmotes", () => {
  it("returns clean text with emotes removed", () => {
    const text = 'Hello [emote]bounces "Hey!"[/emote] world.';
    const { cleanText, emotes } = extractEmotes(text);
    expect(cleanText).toBe("Hello  world.");
    expect(emotes).toHaveLength(1);
  });

  it("collapses extra newlines after emote removal", () => {
    const text = 'Line one.\n\n\n[emote]wiggles[/emote]\n\n\nLine two.';
    const { cleanText } = extractEmotes(text);
    expect(cleanText).not.toContain("\n\n\n");
  });
});

describe("actionToAnimation", () => {
  it("maps excited keywords correctly", () => {
    expect(actionToAnimation("bounces excitedly")).toBe("excited");
    expect(actionToAnimation("wiggles with joy")).toBe("excited");
    expect(actionToAnimation("sparks fly")).toBe("excited");
    expect(actionToAnimation("glows brightly")).toBe("excited");
  });

  it("maps thoughtful keywords correctly", () => {
    expect(actionToAnimation("thinks carefully")).toBe("thoughtful");
    expect(actionToAnimation("ponders the question")).toBe("thoughtful");
    expect(actionToAnimation("tilts head")).toBe("thoughtful");
    expect(actionToAnimation("hums quietly")).toBe("thoughtful");
  });

  it("maps nervous keywords correctly", () => {
    expect(actionToAnimation("shivers a bit")).toBe("nervous");
    expect(actionToAnimation("fidgets nervously")).toBe("nervous");
    expect(actionToAnimation("trembles slightly")).toBe("nervous");
  });

  it("maps sleepy keywords correctly", () => {
    expect(actionToAnimation("yawns widely")).toBe("sleepy");
    expect(actionToAnimation("dozes off")).toBe("sleepy");
    expect(actionToAnimation("feels drowsy")).toBe("sleepy");
  });

  it("maps celebrating keywords correctly", () => {
    expect(actionToAnimation("celebrates wildly")).toBe("celebrating");
    expect(actionToAnimation("dances around")).toBe("celebrating");
    expect(actionToAnimation("twirls in joy")).toBe("celebrating");
  });

  it("maps startled keywords correctly", () => {
    expect(actionToAnimation("jumps in surprise")).toBe("startled");
    expect(actionToAnimation("gasps loudly")).toBe("startled");
    expect(actionToAnimation("blinks rapidly")).toBe("startled");
  });

  it("returns idle for unrecognized actions", () => {
    expect(actionToAnimation("sits quietly")).toBe("idle");
    expect(actionToAnimation("just chilling")).toBe("idle");
    expect(actionToAnimation("")).toBe("idle");
  });
});
