const GROUP_ORDER = [
  { key: "reminders", label: "📅 Reminders & todos" },
  { key: "time",      label: "🕐 Time" },
  { key: "notes",     label: "🗒️  Notes" },
  { key: "journal",   label: "📓 Journal" },
  { key: "memory",    label: "🧠 Memory" },
  { key: "settings",  label: "⚙️  Settings" },
  { key: "stats",     label: "📊 Stats & admin" },
  { key: "admin",     label: "🛡️  Admin tools" },
  { key: "core",      label: "🧹 Utility" },
];

function groupCommands(cmds) {
  const groups = new Map(GROUP_ORDER.map(g => [g.key, []]));
  for (const cmd of cmds) {
    const key = cmd.category ?? "core";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cmd);
  }
  return groups;
}

function renderList(title, cmds) {
  const groups = groupCommands(cmds);
  const lines = [title, ""];
  for (const g of GROUP_ORDER) {
    const inGroup = groups.get(g.key) ?? [];
    if (inGroup.length === 0) continue;
    lines.push(g.label);
    for (const cmd of inGroup) {
      lines.push(`  /${cmd.name} — ${cmd.description}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function renderDetail(cmd) {
  const lines = [`*/${cmd.name}*`, ""];
  if (cmd.usage) lines.push(`Usage: ${cmd.usage}`, "");
  lines.push(cmd.description);
  if (cmd.details) lines.push("", cmd.details);
  if (cmd.examples?.length) {
    lines.push("", "Examples:");
    for (const ex of cmd.examples) lines.push(`  ${ex}`);
  }
  return lines.join("\n");
}

export default {
  name: "help",
  adminOnly: false,
  category: "core",
  description: "List commands. Use /help <command> for details.",
  usage: "/help [command]",
  async run({ isAdmin, commands, args }) {
    const arg = args.trim().replace(/^\//, "").toLowerCase();

    if (arg) {
      const cmd = commands.find(c => c.name === arg);
      if (!cmd) return `No command /${arg}. Type /help for the list.`;
      if (cmd.adminOnly && !isAdmin) return `/${arg} is admin-only.`;
      return renderDetail(cmd);
    }

    if (isAdmin) {
      const userFacing = commands.filter(c => !c.adminOnly && !c.hidden);
      const hiddenOrAdmin = commands.filter(c => c.adminOnly || c.hidden);
      return [
        renderList("*1DotDev bot — admin view*", userFacing),
        "",
        "━━━━━━━━━━━━━━━━",
        "",
        renderList("*Admin-only / hidden*", hiddenOrAdmin),
        "",
        "💬 Or just message me normally.",
      ].join("\n");
    }

    const visible = commands.filter(c => !c.adminOnly && !c.hidden);
    return [
      renderList("*1DotDev bot*", visible),
      "",
      "💬 Or just message me normally.",
    ].join("\n");
  },
};
