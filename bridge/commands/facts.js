import { listFacts } from "../lib/state.js";
export default {
  name: "facts",
  adminOnly: false,
  hidden: true,
  category: "memory",
  description: "List what I remember about you",
  usage: "/facts",
  async run({ from }) {
    const rows = listFacts(from);
    if (rows.length === 0) return "I do not remember anything yet. Use /remember <fact>.";
    return "*What I remember about you*\n" + rows.map((r, i) => `${i + 1}. ${r.fact}`).join("\n");
  },
};
