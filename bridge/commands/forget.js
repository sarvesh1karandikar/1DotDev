import { removeFactByIndex, listFacts } from "../lib/state.js";
export default {
  name: "forget",
  adminOnly: false,
  hidden: true,
  category: "memory",
  description: "Drop fact by its number in /facts",
  usage: "/forget <n>",
  examples: ["/forget 3"],
  async run({ from, args }) {
    const n = parseInt(args.trim(), 10);
    if (!Number.isFinite(n) || n < 1) return "Usage: /forget <n>. Run /facts to see numbers.";
    const removed = removeFactByIndex(from, n);
    if (!removed) return `No fact #${n}. You have ${listFacts(from).length} fact(s).`;
    return `Forgot #${n}: "${removed}"`;
  },
};
