import { addEntry } from "../lib/state.js";
export default {
  name: "entry",
  adminOnly: false,
  description: "Log something against a past date: /entry YYYY-MM-DD <text>",
  async run({ from, args }) {
    const m = args.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/s);
    if (!m) return "Usage: /entry YYYY-MM-DD <text>. Example: /entry 2026-04-14 had dinner with Priya";
    const [, date, content] = m;
    addEntry(from, "entry", content, date);
    return `Logged against ${date}.`;
  },
};
