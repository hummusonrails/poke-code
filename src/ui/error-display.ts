interface ErrorPattern {
  match: RegExp;
  hint: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    match: /EPERM|operation not permitted|EACCES/i,
    hint: "Hint: Grant Full Disk Access to your terminal in System Settings → Privacy & Security",
  },
  {
    match: /401|unauthorized|invalid.*key/i,
    hint: "Hint: Update your API key with /apikey <key>",
  },
  {
    match: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i,
    hint: "Hint: Check your network connection and try again",
  },
  {
    match: /timed?\s*out|timeout/i,
    hint: "Hint: The command exceeded the timeout limit. Try a shorter command or increase the timeout.",
  },
  {
    match: /ENOENT|no such file|not found/i,
    hint: "Hint: Check the file path — use /doctor to verify your setup",
  },
  {
    match: /rate.?limit|429|too many requests/i,
    hint: "Hint: Rate limited — wait a moment and try again",
  },
  {
    match: /ENOSPC|disk.*full|no space/i,
    hint: "Hint: Disk is full — free up space and try again",
  },
];

export function formatErrorWithHint(errorMessage: string): string {
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match.test(errorMessage)) {
      return `Error: ${errorMessage}\n  ${pattern.hint}`;
    }
  }
  return `Error: ${errorMessage}`;
}
