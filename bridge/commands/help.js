export default {
  name: "help",
  adminOnly: false,
  description: "List available commands",
  async run({ isAdmin, commands }) {
    const visible = commands.filter(c => isAdmin || !c.adminOnly);
    const lines = visible.map(c => `/${c.name} — ${c.description}`);
    return `*1DotDev bot commands*\n\n${lines.join("\n")}`;
  },
};
