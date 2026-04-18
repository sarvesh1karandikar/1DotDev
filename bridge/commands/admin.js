import db from "../lib/db.js";
import { costByUser, reminderStats, pendingReminders } from "../lib/state.js";
import { aliasFor } from "../lib/models.js";
import { localTime } from "../lib/tz.js";

function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function sumCost(rows) {
  return rows.reduce((a, r) => a + r.total, 0);
}

function dashboard() {
  const uptime = fmtUptime(Math.round(process.uptime()));
  const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const costToday = sumCost(costByUser(todayStart.getTime()));

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const costMonth = sumCost(costByUser(monthStart.getTime()));

  const msgToday = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?").get(todayStart.getTime()).n;
  const rStats = Object.fromEntries(reminderStats().map(r => [r.status, r.n]));
  const pendingRem = rStats.pending ?? 0;
  const sentRem = rStats.sent ?? 0;
  const failedRem = rStats.failed ?? 0;

  const now = Date.now();
  const dueWithinHour = db.prepare(
    "SELECT COUNT(*) AS n FROM reminders WHERE status = 'pending' AND due_at <= ?"
  ).get(now + 60 * 60 * 1000).n;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
  const modelAlias = aliasFor(model) ?? model;

  return [
    "*1DotDev admin dashboard*",
    "",
    `🟢 Bot up ${uptime} · ${modelAlias} · ${users} users`,
    "",
    "📊 *Today*",
    `  Messages: ${msgToday}`,
    `  Cost: $${costToday.toFixed(4)} (MTD $${costMonth.toFixed(4)})`,
    "",
    "⏰ *Reminders*",
    `  Pending: ${pendingRem} (${dueWithinHour} due in next hour)`,
    `  Sent: ${sentRem} · Failed: ${failedRem}`,
    "",
    "🧭 *Subcommands*",
    "  /admin users — per-user breakdown",
    "  /admin stats — aggregate usage",
    "  /admin templates — WhatsApp templates",
    "  /admin pending — pending reminders",
    "  /admin errors — recent errors",
    "  /admin reminders <number> — reminders for a user",
  ].join("\n");
}

function usersView() {
  const users = db.prepare(
    "SELECT u.number, u.tz, u.model, u.greeted_at, u.created_at, " +
    "(SELECT COUNT(*) FROM messages m WHERE m.number = u.number) AS msgs, " +
    "(SELECT MAX(created_at) FROM messages m WHERE m.number = u.number) AS last_seen " +
    "FROM users u ORDER BY last_seen DESC NULLS LAST"
  ).all();

  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const costRows = costByUser(monthStart.getTime());
  const costByNumber = Object.fromEntries(costRows.map(r => [r.number, r.total]));

  if (users.length === 0) return "No users yet.";
  const lines = ["*Users (MTD cost)*", ""];
  for (const u of users) {
    const cost = (costByNumber[u.number] ?? 0).toFixed(4);
    const last = u.last_seen ? localTime(u.tz, new Date(u.last_seen)) : "never";
    const greeted = u.greeted_at ? "✓" : "✗";
    const m = u.model ? ` · ${aliasFor(u.model) ?? u.model}` : "";
    lines.push(`${u.number} (${u.tz}${m}) greeted:${greeted}`);
    lines.push(`  msgs: ${u.msgs} · last: ${last} · $${cost}`);
  }
  return lines.join("\n");
}

function statsView() {
  const msg = db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= strftime('%s', 'now', '-1 day') * 1000) AS d1,
      COUNT(*) FILTER (WHERE created_at >= strftime('%s', 'now', '-7 days') * 1000) AS d7,
      COUNT(*) FILTER (WHERE created_at >= strftime('%s', 'now', '-30 days') * 1000) AS d30,
      COUNT(*) AS all_time
    FROM messages
  `).get();

  const costAll = db.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total FROM usage").get().total;
  const costByModel = db.prepare(
    "SELECT model, COUNT(*) AS n, SUM(cost_usd) AS total FROM usage GROUP BY model ORDER BY total DESC"
  ).all();

  const lines = [
    "*Aggregate stats*",
    "",
    "Messages",
    `  Last 24h: ${msg.d1}`,
    `  Last 7d:  ${msg.d7}`,
    `  Last 30d: ${msg.d30}`,
    `  All time: ${msg.all_time}`,
    "",
    `Total Anthropic spend: $${costAll.toFixed(4)}`,
    "",
    "By model:",
  ];
  for (const r of costByModel) {
    lines.push(`  ${r.model}: ${r.n} calls · $${(r.total ?? 0).toFixed(4)}`);
  }
  return lines.join("\n");
}

async function templatesView() {
  // Minimal list via Graph API; same call as the infra script.
  const { META_WA_TOKEN, META_WA_BUSINESS_ACCOUNT_ID } = process.env;
  if (!META_WA_TOKEN || !META_WA_BUSINESS_ACCOUNT_ID) return "Template API credentials missing.";
  try {
    const url = `https://graph.facebook.com/v21.0/${META_WA_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,rejected_reason&limit=50`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${META_WA_TOKEN}` } });
    const body = await resp.json();
    if (body.error) return `Meta error: ${body.error.message}`;
    const rows = body.data ?? [];
    if (rows.length === 0) return "No templates yet.";
    const lines = ["*WhatsApp templates*", ""];
    for (const r of rows) {
      const icon = r.status === "APPROVED" ? "✅" : r.status === "PENDING" ? "⏳" : r.status === "REJECTED" ? "❌" : "⚠";
      const rej = r.rejected_reason && r.rejected_reason !== "NONE" ? ` (${r.rejected_reason})` : "";
      lines.push(`${icon} ${r.name} — ${r.status}${rej}`);
    }
    return lines.join("\n");
  } catch (e) {
    return `Fetch failed: ${e.message}`;
  }
}

function pendingView() {
  const now = Date.now();
  const upcoming = db.prepare(
    "SELECT id, number, text, due_at FROM reminders WHERE status = 'pending' ORDER BY due_at LIMIT 20"
  ).all();
  if (upcoming.length === 0) return "No pending reminders.";
  const lines = ["*Pending reminders (top 20)*", ""];
  for (const r of upcoming) {
    const overdue = r.due_at < now ? " ⚠ overdue" : "";
    const when = new Date(r.due_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    lines.push(`#${r.id} ${r.number}: [${when}]${overdue}`);
    lines.push(`  ${r.text}`);
  }
  return lines.join("\n");
}

function errorsView() {
  const rows = db.prepare(
    "SELECT id, number, error, created_at FROM reminders WHERE status = 'failed' ORDER BY id DESC LIMIT 10"
  ).all();
  if (rows.length === 0) return "No errors recorded.";
  const lines = ["*Recent errors*", ""];
  for (const r of rows) {
    lines.push(`#${r.id} ${r.number}: ${r.error ?? "(no detail)"}`);
  }
  return lines.join("\n");
}

function remindersForUser(number) {
  const rows = db.prepare(
    "SELECT id, text, due_at, status FROM reminders WHERE number = ? ORDER BY due_at DESC LIMIT 20"
  ).all(number);
  if (rows.length === 0) return `No reminders for ${number}.`;
  const lines = [`*Reminders — ${number}*`, ""];
  for (const r of rows) {
    const when = new Date(r.due_at).toISOString().replace("T", " ").slice(0, 16) + " UTC";
    lines.push(`#${r.id} [${r.status}] ${when} — ${r.text}`);
  }
  return lines.join("\n");
}

export default {
  name: "admin",
  adminOnly: true,
  category: "admin",
  description: "Admin dashboard + subcommands",
  usage: "/admin | /admin <users|stats|templates|pending|errors|reminders <number>>",
  examples: ["/admin", "/admin users", "/admin templates"],
  async run({ args }) {
    const a = args.trim();
    if (!a) return dashboard();
    const [sub, ...rest] = a.split(/\s+/);
    switch (sub) {
      case "users": return usersView();
      case "stats": return statsView();
      case "templates": return await templatesView();
      case "pending": return pendingView();
      case "errors": return errorsView();
      case "reminders": {
        const number = rest[0];
        if (!number) return "Usage: /admin reminders <number>";
        return remindersForUser(number.replace(/^\+/, ""));
      }
      default: return `Unknown /admin subcommand: ${sub}\nTry: /admin, /admin users, /admin stats, /admin templates, /admin pending, /admin errors, /admin reminders <number>`;
    }
  },
};
