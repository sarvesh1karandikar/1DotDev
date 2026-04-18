import * as chrono from "chrono-node";
import { addReminder } from "../lib/state.js";
import { localTime } from "../lib/tz.js";

function parseWhenAndText(args, userTz) {
  const trimmed = args.trim();
  if (!trimmed) return { error: "Usage: /remind <when> <what>. Try: /remind tomorrow 3pm call mom" };

  const now = new Date();
  // chrono-node accepts a reference date and timezone
  const results = chrono.parse(trimmed, now, { forwardDate: true, timezone: userTz });
  if (results.length === 0) {
    return { error: 'Could not parse the time. Try: "tomorrow 3pm", "in 2 hours", "2026-04-25 09:00".' };
  }
  const first = results[0];
  const dueDate = first.start.date();
  if (dueDate.getTime() <= now.getTime()) {
    return { error: "That time has already passed. Try a future time." };
  }

  // Strip the matched time phrase from the original args to get reminder text
  const startIdx = first.index;
  const endIdx = startIdx + first.text.length;
  const text = (trimmed.slice(0, startIdx) + trimmed.slice(endIdx)).trim().replace(/^at\s+/i, "").trim();
  if (!text) return { error: "Got the time, but I need some text too. Try: /remind tomorrow 3pm call mom" };

  return { dueAt: dueDate.getTime(), text };
}

export default {
  name: "remind",
  adminOnly: false,
  category: "reminders",
  description: "Set a reminder",
  usage: "/remind <when> <what>",
  examples: [
    "/remind tomorrow 3pm call mom",
    "/remind in 2 hours take meds",
    "/remind 2026-04-25 09:00 buy gift",
  ],
  details: "Times are parsed in your timezone. See /reminders to list, /cancel <n> to remove.",
  async run({ from, user, args }) {
    const parsed = parseWhenAndText(args, user.tz);
    if (parsed.error) return parsed.error;

    addReminder(from, parsed.text, parsed.dueAt);
    const when = localTime(user.tz, new Date(parsed.dueAt));
    return `✓ Reminder set for ${when}\n  "${parsed.text}"`;
  },
};
