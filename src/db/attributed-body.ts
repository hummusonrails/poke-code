// Known binary artifacts from NSAttributedString/NSKeyedArchiver
const BINARY_PATTERNS = [
  /NSKeyedArchiver/,
  /NSString/,
  /NSDictionary/,
  /NSMutableString/,
  /NSMutableDictionary/,
  /NSMutableArray/,
  /NSObject/,
  /NSArray/,
  /NSValue/,
  /DDScannerResult/,
  /\$class[A-Z]/,
  /RARQTQPRSRRVN/,
  /versionYdd-result/,
  /classesWNSValue/,
  /classnameX\$/,
];

function containsBinaryArtifacts(text: string): boolean {
  return BINARY_PATTERNS.some((p) => p.test(text));
}

function cleanExtractedText(text: string): string | null {
  if (!text || text.length === 0) return null;
  // Reject text that's mostly non-printable or contains known binary patterns
  if (containsBinaryArtifacts(text)) return null;
  // Reject if more than 10% of chars are non-printable/replacement chars
  const nonPrintable = text.replace(/[\x20-\x7e\n\r\t\u00a0-\uffff]/g, "");
  if (nonPrintable.length / text.length > 0.1) return null;
  return text.trim() || null;
}

export function extractTextFromAttributedBody(data: Buffer): string | null {
  if (data.length < 10) {
    return null;
  }

  const typedStreamResult = extractViaTypedStream(data);
  if (typedStreamResult) {
    const cleaned = cleanExtractedText(typedStreamResult);
    if (cleaned) return cleaned;
  }

  const chunkResult = extractViaChunkScan(data);
  if (chunkResult) {
    const cleaned = cleanExtractedText(chunkResult);
    if (cleaned) return cleaned;
  }

  return null;
}

function extractViaTypedStream(data: Buffer): string | null {
  const bytes = new Uint8Array(data);

  for (let i = 1; i < bytes.length; i++) {
    if (bytes[i] === 0x2b && bytes[i - 1] === 0x01) {
      let pos = i + 1;
      if (pos >= bytes.length) continue;

      let length: number;

      if (bytes[pos] < 0x80) {
        length = bytes[pos];
        pos += 1;
      } else if (bytes[pos] === 0x81 && pos + 2 < bytes.length) {
        length = (bytes[pos + 1] << 8) | bytes[pos + 2];
        pos += 3;
      } else if (bytes[pos] === 0x82 && pos + 4 < bytes.length) {
        length = (bytes[pos + 1] << 24) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 8) | bytes[pos + 4];
        pos += 5;
      } else {
        continue;
      }

      if (length <= 0 || pos + length > bytes.length) continue;

      const textData = data.subarray(pos, pos + length);
      const text = textData.toString("utf8").trim();
      if (text.length > 0) {
        return text;
      }
    }
  }

  return null;
}

function extractViaChunkScan(data: Buffer): string | null {
  const chunks: Buffer[] = [];
  let current: number[] = [];

  for (const byte of data) {
    if (byte === 0x00) {
      if (current.length > 0) {
        chunks.push(Buffer.from(current));
        current = [];
      }
    } else {
      current.push(byte);
    }
  }
  if (current.length > 0) {
    chunks.push(Buffer.from(current));
  }

  let bestString = "";

  for (const chunk of chunks) {
    let str: string;
    try {
      str = chunk.toString("utf8");
    } catch {
      continue;
    }

    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally stripping control characters from strings
    const printable = str.replace(/[\u0000-\u001f\u007f]/g, "");
    if (printable.length >= 2 && printable.length > bestString.length) {
      if (!printable.startsWith("NS") && !printable.startsWith('@"')) {
        bestString = printable;
      }
    }
  }

  const trimmed = bestString.trim();
  return trimmed.length > 0 ? trimmed : null;
}
