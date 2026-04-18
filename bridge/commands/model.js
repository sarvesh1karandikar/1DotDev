import { setModel } from "../lib/users.js";
import { MODELS, TIER_WARNINGS, resolveModel, aliasFor } from "../lib/models.js";

export default {
  name: "model",
  adminOnly: false,
  hidden: true,
  category: "settings",
  description: "Show or switch Claude model",
  usage: "/model [haiku|sonnet|opus]",
  examples: ["/model", "/model sonnet"],
  async run({ from, user, args }) {
    const a = args.trim().toLowerCase();
    if (!a) {
      const current = user.model ?? process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
      const alias = aliasFor(current) ?? current;
      const lines = ["*Current model*: " + alias + " (" + current + ")", "", "*Available*"];
      for (const [k, m] of Object.entries(MODELS)) {
        lines.push(`/model ${k} — ${m.label}${TIER_WARNINGS[m.tier]}`);
      }
      return lines.join("\n");
    }
    const picked = resolveModel(a);
    if (!picked) return `Unknown model "${a}". Options: ${Object.keys(MODELS).join(", ")}.`;
    setModel(from, picked.id);
    return `Model set to ${picked.label}${TIER_WARNINGS[picked.tier]}.`;
  },
};
