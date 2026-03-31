export interface ParsedSchedule {
  cron: string;
  oneShot: boolean;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseTime(text: string): { hour: number; minute: number } | null {
  if (text.includes("midnight")) return { hour: 0, minute: 0 };
  if (text.includes("noon")) return { hour: 12, minute: 0 };

  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  return { hour, minute };
}

export function parseNaturalSchedule(input: string): ParsedSchedule | null {
  const text = input.toLowerCase().trim();

  // One-shot: "once at Xpm", "in N hours"
  const isOneShot = text.startsWith("once ") || text.startsWith("in ");

  // "in N hours" / "in N minutes"
  const inMatch = text.match(/^in\s+(\d+)\s+(hour|minute)s?$/);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2];
    const target = new Date();
    if (unit === "hour") target.setHours(target.getHours() + amount);
    else target.setMinutes(target.getMinutes() + amount);
    return { cron: `${target.getMinutes()} ${target.getHours()} * * *`, oneShot: true };
  }

  // "every minute"
  if (text === "every minute") return { cron: "* * * * *", oneShot: false };

  // "every hour"
  if (text === "every hour") return { cron: "0 * * * *", oneShot: false };

  // "every N minutes"
  const minMatch = text.match(/^every\s+(\d+)\s+minutes?$/);
  if (minMatch) {
    return { cron: `*/${minMatch[1]} * * * *`, oneShot: false };
  }

  // "every N hours"
  const hrMatch = text.match(/^every\s+(\d+)\s+hours?$/);
  if (hrMatch) {
    return { cron: `0 */${hrMatch[1]} * * *`, oneShot: false };
  }

  // "every day at Xam/pm" or "at Xam/pm" or "at midnight/noon"
  const dailyMatch = text.match(/^(?:every\s+day\s+)?at\s+(.+)$/);
  if (dailyMatch) {
    const time = parseTime(dailyMatch[1]);
    if (time) return { cron: `${time.minute} ${time.hour} * * *`, oneShot: isOneShot };
  }

  // "once at Xam/pm"
  const onceAtMatch = text.match(/^once\s+at\s+(.+)$/);
  if (onceAtMatch) {
    const time = parseTime(onceAtMatch[1]);
    if (time) return { cron: `${time.minute} ${time.hour} * * *`, oneShot: true };
  }

  // "every weekday at Xam/pm"
  const weekdayMatch = text.match(/^every\s+weekday(?:\s+at\s+(.+))?$/);
  if (weekdayMatch) {
    const time = weekdayMatch[1] ? parseTime(weekdayMatch[1]) : { hour: 9, minute: 0 };
    if (time) return { cron: `${time.minute} ${time.hour} * * 1-5`, oneShot: false };
  }

  // "every <day>" or "every <day> at Xam/pm"
  for (const [name, num] of Object.entries(DAY_MAP)) {
    const dayPattern = new RegExp(`^every\\s+${name}(?:\\s+at\\s+(.+))?$`);
    const dayMatch = text.match(dayPattern);
    if (dayMatch) {
      const time = dayMatch[1] ? parseTime(dayMatch[1]) : { hour: 9, minute: 0 };
      if (time) return { cron: `${time.minute} ${time.hour} * * ${num}`, oneShot: false };
    }
  }

  return null;
}
