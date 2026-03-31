import { describe, expect, it } from "vitest";
import { extractTextFromAttributedBody } from "../../src/db/attributed-body.js";

describe("extractTextFromAttributedBody", () => {
  it("returns null for empty data", () => {
    expect(extractTextFromAttributedBody(Buffer.alloc(0))).toBeNull();
  });

  it("returns null for data shorter than 10 bytes", () => {
    expect(extractTextFromAttributedBody(Buffer.from("short"))).toBeNull();
  });

  it("extracts text from typedstream format with single-byte length", () => {
    const text = "Hello from Poke!";
    const textBytes = Buffer.from(text, "utf8");
    const prefix = Buffer.alloc(20, 0);
    prefix[18] = 0x01;
    prefix[19] = 0x2b;
    const lengthByte = Buffer.from([textBytes.length]);
    const suffix = Buffer.alloc(5, 0);
    const data = Buffer.concat([prefix, lengthByte, textBytes, suffix]);

    expect(extractTextFromAttributedBody(data)).toBe("Hello from Poke!");
  });

  it("extracts text from typedstream format with two-byte length", () => {
    const text = "A".repeat(200);
    const textBytes = Buffer.from(text, "utf8");
    const prefix = Buffer.alloc(20, 0);
    prefix[18] = 0x01;
    prefix[19] = 0x2b;
    const lengthBytes = Buffer.from([0x81, 0x00, 200]);
    const data = Buffer.concat([prefix, lengthBytes, textBytes]);

    expect(extractTextFromAttributedBody(data)).toBe(text);
  });

  it("falls back to longest UTF-8 chunk between nulls", () => {
    const chunks = [
      Buffer.from("NS"),
      Buffer.from([0x00]),
      Buffer.from('@"NSString"'),
      Buffer.from([0x00]),
      Buffer.from("This is the actual message content"),
      Buffer.from([0x00]),
      Buffer.from("ab"),
    ];
    const data = Buffer.concat(chunks);

    expect(extractTextFromAttributedBody(data)).toBe("This is the actual message content");
  });

  it("trims whitespace from extracted text", () => {
    const text = "  Hello with spaces  ";
    const textBytes = Buffer.from(text, "utf8");
    const prefix = Buffer.alloc(20, 0);
    prefix[18] = 0x01;
    prefix[19] = 0x2b;
    const lengthByte = Buffer.from([textBytes.length]);
    const data = Buffer.concat([prefix, lengthByte, textBytes]);

    expect(extractTextFromAttributedBody(data)).toBe("Hello with spaces");
  });
});
