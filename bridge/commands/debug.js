import db from "../lib/db.js";
export default {
  name: "debug",
  adminOnly: true,
  category: "stats",
  description: "Bot uptime, model, counts",
  usage: "/debug",
  async run() {
    const uptimeS = Math.round(process.uptime());
    const h = Math.floor(uptimeS / 3600), m = Math.floor((uptimeS % 3600) / 60), s = uptimeS % 60;
    const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    const msgs = db.prepare("SELECT COUNT(*) AS n FROM messages").get().n;
    const entries = db.prepare("SELECT COUNT(*) AS n FROM entries").get().n;
    const facts = db.prepare("SELECT COUNT(*) AS n FROM facts").get().n;
    return [
      `*Bot debug*`,
      `Model: ${process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"}`,
      `Uptime: ${h}h ${m}m ${s}s`,
      `Users: ${users}`,
      `Messages: ${msgs}`,
      `Entries: ${entries}`,
      `Facts: ${facts}`,
      `Node: ${process.version}`,
    ].join("\n");
  },
};
