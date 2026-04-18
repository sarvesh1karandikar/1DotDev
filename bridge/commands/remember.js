import { addFact } from "../lib/state.js";
export default {
  name: "remember",
  adminOnly: false,
  hidden: true,
  category: "memory",
  description: "Save a fact I should remember about you",
  usage: "/remember <fact>",
  examples: ["/remember I am vegetarian"],
  async run({ from, args }) {
    const fact = args.trim();
    if (!fact) return "Usage: /remember <fact>. Example: /remember I am vegetarian";
    addFact(from, fact);
    return `Got it. I will remember: "${fact}"`;
  },
};
