import { searchEntries } from "../lib/state.js";
export default {
  name: "recall",
  adminOnly: false,
  description: "Search across notes, journal, entries: /recall <query>",
  async run({ from, args }) {
    const q = args.trim();
    if (!q) return "Usage: /recall <query>";
    const rows = searchEntries(from, q, 20);
    if (rows.length === 0) return `Nothing matching "${q}".`;
    return `*Matches for "${q}"*\n` + rows.map(r => `[${r.local_date} ${r.kind}] ${r.content}`).join("\n");
  },
};
