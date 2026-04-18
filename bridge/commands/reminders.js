import { pendingReminders, cancelReminder } from "../lib/state.js";
import { localTime } from "../lib/tz.js";

export default {
  name: "reminders",
  adminOnly: false,
  category: "reminders",
  description: "List or cancel your pending reminders",
  usage: "/reminders | /reminders cancel <n>",
  examples: ["/reminders", "/reminders cancel 2"],
  async run({ from, user, args }) {
    const a = args.trim();

    if (a.startsWith("cancel ") || a.startsWith("delete ")) {
      const n = parseInt(a.split(/\s+/)[1], 10);
      if (!Number.isFinite(n) || n < 1) return "Usage: /reminders cancel <n>";
      const cancelled = cancelReminder(from, n);
      if (!cancelled) return `No reminder #${n}. Run /reminders to see numbers.`;
      return `Cancelled #${n}: "${cancelled.text}"`;
    }

    const rows = pendingReminders(from);
    if (rows.length === 0) return "No reminders. Set one with /remind <when> <what>.";
    const lines = ["*Your reminders*"];
    rows.forEach((r, i) => {
      lines.push(`${i + 1}. [${localTime(user.tz, new Date(r.due_at))}] ${r.text}`);
    });
    lines.push("", "Use /reminders cancel <n> to remove one.");
    return lines.join("\n");
  },
};
