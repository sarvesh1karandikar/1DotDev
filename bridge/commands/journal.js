import { addEntry, entriesOn, recentEntries } from "../lib/state.js";
import { localDate } from "../lib/tz.js";
export default {
  name: "journal",
  adminOnly: false,
  hidden: true,
  category: "journal",
  description: "Log a reflection entry",
  usage: "/journal <text> | /journal today | /journal on YYYY-MM-DD",
  examples: [
    "/journal had a great run today",
    "/journal today",
    "/journal on 2026-04-14",
  ],
  async run({ from, user, args }) {
    const a = args.trim();
    if (a === "today") {
      const d = localDate(user.tz);
      const rows = entriesOn(from, d, "journal");
      if (rows.length === 0) return `No journal entries for today (${d}).`;
      return `*Journal — ${d}*\n` + rows.map(r => `- ${r.content}`).join("\n");
    }
    if (a.startsWith("on ")) {
      const d = a.slice("on ".length).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Usage: /journal on YYYY-MM-DD";
      const rows = entriesOn(from, d, "journal");
      if (rows.length === 0) return `No journal entries for ${d}.`;
      return `*Journal — ${d}*\n` + rows.map(r => `- ${r.content}`).join("\n");
    }
    if (!a) {
      const rows = recentEntries(from, "journal", 5);
      if (rows.length === 0) return "Usage: /journal <text>. No entries yet.";
      return "*Recent journal entries*\n" + rows.map(r => `[${r.local_date}] ${r.content}`).join("\n");
    }
    const d = localDate(user.tz);
    addEntry(from, "journal", a, d);
    return `Journaled on ${d}.`;
  },
};
