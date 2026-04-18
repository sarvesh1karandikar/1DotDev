import db from "./db.js";
import { fetchAll } from "./rss.js";
import { createClient } from "./anthropic.js";
import { logUsage } from "./anthropic.js";
import { sendText, sendTemplate } from "./whatsapp.js";
import { localTime, localDate } from "./tz.js";
import { ensureUser } from "./users.js";

const SUMMARIZER_MODEL = "claude-haiku-4-5";
const WINDOW_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_NAME = "reminder_notification";
const TEMPLATE_LANG = "en";

function lastInboundMs(number) {
  const row = db.prepare(
    "SELECT MAX(created_at) AS last FROM messages WHERE number = ? AND role = 'user'"
  ).get(number);
  return row?.last ?? 0;
}

export function getSubscription(number) {
  const row = db.prepare("SELECT * FROM digest_subscriptions WHERE number = ?").get(number);
  if (!row) return null;
  return { ...row, topics: JSON.parse(row.topics) };
}

export function upsertSubscription(number, patch) {
  const existing = getSubscription(number);
  const now = Date.now();
  if (!existing) {
    db.prepare(
      "INSERT INTO digest_subscriptions (number, hour, minute, topics, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(
      number,
      patch.hour ?? 7,
      patch.minute ?? 30,
      JSON.stringify(patch.topics ?? []),
      patch.enabled ?? 1,
      now
    );
    return getSubscription(number);
  }
  const next = {
    hour: patch.hour ?? existing.hour,
    minute: patch.minute ?? existing.minute,
    topics: JSON.stringify(patch.topics ?? existing.topics),
    enabled: patch.enabled ?? existing.enabled,
  };
  db.prepare(
    "UPDATE digest_subscriptions SET hour = ?, minute = ?, topics = ?, enabled = ? WHERE number = ?"
  ).run(next.hour, next.minute, next.topics, next.enabled, number);
  return getSubscription(number);
}

export function allEnabledSubscriptions() {
  const rows = db.prepare("SELECT * FROM digest_subscriptions WHERE enabled = 1").all();
  return rows.map(r => ({ ...r, topics: JSON.parse(r.topics) }));
}

export function markDigestSent(number, at = Date.now()) {
  db.prepare("UPDATE digest_subscriptions SET last_sent_at = ? WHERE number = ?").run(at, number);
}

async function summarize(anthropic, number, perTopic) {
  const blob = perTopic
    .map(t => {
      if (t.error) return `# ${t.topic}\n(fetch error: ${t.error})`;
      if (!t.items.length) return `# ${t.topic}\n(no recent items)`;
      const items = t.items.map((i, idx) => `${idx + 1}. ${i.title}${i.source ? ` (${i.source})` : ""}${i.summary ? ` — ${i.summary}` : ""}`).join("\n");
      return `# ${t.topic}\n${items}`;
    })
    .join("\n\n");

  const sys = `You write concise WhatsApp morning briefs. For each topic, write 2–4 bullet points capturing the most newsworthy items. Skip duplicates and filler. Use the format:

*<topic>*
• item (with source in parentheses if notable)

No preamble, no sign-off. Use plain text only; WhatsApp supports *bold* with asterisks.`;

  const resp = await anthropic.messages.create({
    model: SUMMARIZER_MODEL,
    max_tokens: 1024,
    system: sys,
    messages: [{ role: "user", content: blob }],
  });
  logUsage(number, SUMMARIZER_MODEL, resp.usage);
  return resp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
}

export async function buildDigest(number, topics) {
  if (!topics.length) return "You have no topics yet. Add one: /digest add <topic>";
  const anthropic = createClient(process.env.ANTHROPIC_API_KEY);
  const fetched = await fetchAll(topics, { limit: 5 });
  const summary = await summarize(anthropic, number, fetched);
  const user = ensureUser(number);
  const header = `☕ *Morning brief — ${localDate(user.tz)}*`;
  return `${header}\n\n${summary}`;
}

export async function sendDigestFor(sub) {
  try {
    const body = await buildDigest(sub.number, sub.topics);
    const inWindow = (Date.now() - lastInboundMs(sub.number)) < WINDOW_MS;
    if (inWindow) {
      await sendText(sub.number, body);
    } else {
      // Fallback: send the approved template (acts as re-engagement nudge).
      // User taps/replies, 24h window opens, next digest delivers in full.
      await sendTemplate(sub.number, TEMPLATE_NAME, TEMPLATE_LANG, ["your daily news digest is ready — reply to receive it"]);
    }
    markDigestSent(sub.number);
    console.log(`digest sent to ${sub.number} (${inWindow ? "free-form" : "template-stub"})`);
    return { ok: true };
  } catch (e) {
    const detail = e.response?.data?.error?.message ?? e.message;
    console.error(`digest to ${sub.number} failed: ${detail}`);
    return { ok: false, error: detail };
  }
}

export function isDue(sub, now = new Date()) {
  const user = ensureUser(sub.number);
  const tz = user.tz;
  // Get current local hour/minute in user's tz
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = parseInt(parts.find(p => p.type === "hour").value, 10);
  const mm = parseInt(parts.find(p => p.type === "minute").value, 10);
  if (hh !== sub.hour || mm !== sub.minute) return false;

  // Don't fire twice in the same local day
  if (sub.last_sent_at) {
    const lastLocal = localDate(tz, new Date(sub.last_sent_at));
    const nowLocal = localDate(tz, now);
    if (lastLocal === nowLocal) return false;
  }
  return true;
}
