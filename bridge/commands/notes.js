import { recentEntries, searchEntries } from "../lib/state.js";
export default {
  name: "notes",
  adminOnly: false,
  hidden: true,
  category: "notes",
  description: "List recent notes, or search them",
  usage: "/notes | /notes search <query>",
  async run({ from, args }) {
    const a = args.trim();
    if (a.startsWith("search ")) {
      const q = a.slice("search ".length).trim();
      if (!q) return "Usage: /notes search <query>";
      const rows = searchEntries(from, q).filter(r => r.kind === "note");
      if (rows.length === 0) return `No notes matching "${q}".`;
      return `*Notes matching "${q}"*\n` + rows.map(r => `[${r.local_date}] ${r.content}`).join("\n");
    }
    const rows = recentEntries(from, "note", 10);
    if (rows.length === 0) return "No notes yet. Use /note <text>.";
    return "*Your last 10 notes*\n" + rows.map(r => `[${r.local_date}] ${r.content}`).join("\n");
  },
};
