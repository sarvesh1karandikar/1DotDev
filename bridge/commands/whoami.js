import { messageCount, listFacts } from "../lib/state.js";
import { localTime } from "../lib/tz.js";
import { aliasFor } from "../lib/models.js";
export default {
  name: "whoami",
  adminOnly: false,
  hidden: true,
  category: "stats",
  description: "Show my profile: number, timezone, model, stats",
  usage: "/whoami",
  async run({ from, user, isAdmin }) {
    const msgs = messageCount(from);
    const factsN = listFacts(from).length;
    const activeModel = user.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
    const alias = aliasFor(activeModel) ?? activeModel;
    return [
      `*You*`,
      `Number: ${from}`,
      `Timezone: ${user.tz} (${localTime(user.tz)})`,
      `Model: ${alias} (${activeModel})`,
      `Messages on record: ${msgs}`,
      `Remembered facts: ${factsN}`,
      `Admin: ${isAdmin ? "yes" : "no"}`,
    ].join("\n");
  },
};
