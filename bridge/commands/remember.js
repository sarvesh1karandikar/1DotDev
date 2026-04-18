import { addFact } from "../lib/state.js";
export default {
  name: "remember",
  adminOnly: false,
  description: "Save a fact I should remember about you",
  async run({ from, args }) {
    const fact = args.trim();
    if (!fact) return "Usage: /remember <fact>. Example: /remember I am vegetarian";
    addFact(from, fact);
    return `Got it. I will remember: "${fact}"`;
  },
};
