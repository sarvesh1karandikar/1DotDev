import { clearMessages } from "../lib/state.js";
export default {
  name: "reset",
  adminOnly: false,
  description: "Clear our chat history (facts kept)",
  async run({ from }) {
    const n = clearMessages(from);
    return `Cleared ${n} message(s). Starting fresh.`;
  },
};
