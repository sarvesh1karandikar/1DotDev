import { entriesOn } from "../lib/state.js";
export default {
  name: "on",
  adminOnly: false,
  hidden: true,
  category: "journal",
  description: "Show everything logged on a date",
  usage: "/on YYYY-MM-DD",
  async run({ from, args }) {
    const d = args.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Usage: /on YYYY-MM-DD";
    const rows = entriesOn(from, d);
    if (rows.length === 0) return `Nothing on ${d}.`;
    return `*${d}*\n` + rows.map(r => `[${r.kind}] ${r.content}`).join("\n");
  },
};
