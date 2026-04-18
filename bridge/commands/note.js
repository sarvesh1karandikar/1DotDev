import { addEntry } from "../lib/state.js";
import { localDate } from "../lib/tz.js";
export default {
  name: "note",
  adminOnly: false,
  hidden: true,
  category: "notes",
  description: "Save a quick note",
  usage: "/note <text>",
  async run({ from, user, args }) {
    const text = args.trim();
    if (!text) return "Usage: /note <text>";
    const d = localDate(user.tz);
    addEntry(from, "note", text, d);
    return `Noted on ${d}.`;
  },
};
