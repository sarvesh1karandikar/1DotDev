import { userCost, costByUser } from "../lib/state.js";
import { localDate } from "../lib/tz.js";

function startOfLocalDay(tz, date = new Date()) {
  const d = localDate(tz, date);
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) - getOffsetMs(tz, date);
}

function getOffsetMs(tz, date) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
  const parts = dtf.formatToParts(date);
  const offsetPart = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT";
  const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = parseInt(match[3] ?? "0", 10);
  return sign * (hours * 60 + mins) * 60 * 1000;
}

function fmtUserLine(row) {
  return `  ${row.number}: $${row.total.toFixed(4)} (${row.input} in / ${row.output} out)`;
}

function sumTotals(rows) {
  return rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, input: acc.input + r.input, output: acc.output + r.output }),
    { total: 0, input: 0, output: 0 }
  );
}

export default {
  name: "cost",
  adminOnly: false,
  hidden: true,
  category: "stats",
  description: "Show Anthropic token spend (admins see all users)",
  usage: "/cost",
  async run({ from, user, isAdmin }) {
    const now = new Date();
    const startToday = startOfLocalDay(user.tz, now);
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

    if (!isAdmin) {
      const today = userCost(from, startToday);
      const month = userCost(from, monthStart);
      return [
        "*Your Anthropic spend*",
        `Today: $${today.total.toFixed(4)} (${today.input} in / ${today.output} out)`,
        `This month: $${month.total.toFixed(4)} (${month.input} in / ${month.output} out)`,
      ].join("\n");
    }

    const todayByUser = costByUser(startToday);
    const monthByUser = costByUser(monthStart);
    const todayTotal = sumTotals(todayByUser);
    const monthTotal = sumTotals(monthByUser);

    const lines = ["*Anthropic spend (admin view)*", "", `_Today (since local midnight, ${user.tz})_`];
    if (todayByUser.length === 0) lines.push("  (none)");
    else todayByUser.forEach(r => lines.push(fmtUserLine(r)));
    lines.push(`  *Total*: $${todayTotal.total.toFixed(4)} (${todayTotal.input} in / ${todayTotal.output} out)`);
    lines.push("", "_This month_");
    if (monthByUser.length === 0) lines.push("  (none)");
    else monthByUser.forEach(r => lines.push(fmtUserLine(r)));
    lines.push(`  *Total*: $${monthTotal.total.toFixed(4)} (${monthTotal.input} in / ${monthTotal.output} out)`);
    return lines.join("\n");
  },
};
