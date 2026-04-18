import { clearMessages } from "../lib/state.js";
export default {
  name: "reset",
  adminOnly: false,
  category: "core",
  description: "Clear our chat history (facts kept)",
  usage: "/reset",
  async run({ from }) {
    const n = clearMessages(from);
    return `Cleared ${n} message(s). Starting fresh.`;
  },
};
