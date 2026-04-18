import { getSubscription, upsertSubscription, buildDigest, sendDigestFor } from "../lib/digest.js";
import { sendText } from "../lib/whatsapp.js";

const MAX_TOPICS = 10;

function parseHHMM(s) {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?$/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hour: hh, minute: mm };
}

function fmtSub(sub) {
  if (!sub) return "You are not subscribed. Try /digest on";
  const time = `${String(sub.hour).padStart(2, "0")}:${String(sub.minute).padStart(2, "0")}`;
  const status = sub.enabled ? "✅ on" : "⏸ paused";
  const topics = sub.topics.length
    ? sub.topics.map((t, i) => `  ${i + 1}. ${t}`).join("\n")
    : "  (none — use /digest add <topic>)";
  return [
    "*Your daily digest*",
    `Status: ${status}`,
    `Time: ${time} (your local tz)`,
    `Topics:`,
    topics,
    "",
    "Manage: /digest on|off · /digest time 7:30 · /digest add <topic> · /digest remove <n> · /digest now",
  ].join("\n");
}

export default {
  name: "digest",
  adminOnly: false,
  category: "reminders",
  description: "Daily news digest — you pick topics, bot delivers every morning",
  usage: "/digest | /digest on|off | /digest time <hh:mm> | /digest add <topic> | /digest remove <n> | /digest topics | /digest now | /digest clear",
  examples: [
    "/digest on",
    "/digest add h1b news",
    "/digest add indian stock market",
    "/digest time 7:30",
    "/digest now",
  ],
  details: "Topics are free text — anything Google News can search. Max 10 per user.",
  async run({ from, args }) {
    const a = args.trim();

    if (a === "") {
      return fmtSub(getSubscription(from));
    }

    if (a === "on") {
      const sub = upsertSubscription(from, { enabled: 1 });
      return `Digest enabled.\n\n${fmtSub(sub)}`;
    }
    if (a === "off") {
      const sub = upsertSubscription(from, { enabled: 0 });
      return "Digest paused. Turn back on with /digest on.";
    }

    if (a.startsWith("time ")) {
      const parsed = parseHHMM(a.slice(5));
      if (!parsed) return "Usage: /digest time 7:30 (or 7am / 7:30pm)";
      const sub = upsertSubscription(from, parsed);
      return `Digest time set to ${String(sub.hour).padStart(2, "0")}:${String(sub.minute).padStart(2, "0")}.`;
    }

    if (a === "topics") {
      const sub = getSubscription(from);
      const topics = sub?.topics ?? [];
      if (topics.length === 0) return "No topics yet. Add one: /digest add <topic>";
      return "*Your topics*\n" + topics.map((t, i) => `${i + 1}. ${t}`).join("\n");
    }

    if (a.startsWith("add ")) {
      const topic = a.slice(4).trim();
      if (!topic) return "Usage: /digest add <topic>";
      if (topic.length > 80) return "Topic too long (max 80 chars).";
      const existing = getSubscription(from);
      const topics = existing?.topics ?? [];
      if (topics.includes(topic)) return `"${topic}" is already in your list.`;
      if (topics.length >= MAX_TOPICS) return `Max ${MAX_TOPICS} topics. Remove one first: /digest remove <n>`;
      const sub = upsertSubscription(from, { topics: [...topics, topic] });
      const onHint = sub.enabled ? "" : "\n\nDigest is currently paused. Turn on: /digest on";
      return `Added "${topic}". You now have ${sub.topics.length} topic(s).${onHint}`;
    }

    if (a.startsWith("remove ")) {
      const n = parseInt(a.split(/\s+/)[1], 10);
      if (!Number.isFinite(n) || n < 1) return "Usage: /digest remove <n>";
      const existing = getSubscription(from);
      if (!existing || !existing.topics[n - 1]) return `No topic #${n}.`;
      const removed = existing.topics[n - 1];
      const next = existing.topics.filter((_, i) => i !== n - 1);
      upsertSubscription(from, { topics: next });
      return `Removed "${removed}". You have ${next.length} topic(s) left.`;
    }

    if (a === "clear") {
      upsertSubscription(from, { topics: [] });
      return "All topics cleared.";
    }

    if (a === "now") {
      const sub = getSubscription(from);
      if (!sub || sub.topics.length === 0) return "No topics yet. Add one: /digest add <topic>";
      // Acknowledge immediately since building can take several seconds.
      setTimeout(async () => {
        try {
          const body = await buildDigest(from, sub.topics);
          await sendText(from, body);
        } catch (e) {
          await sendText(from, `Failed to build digest: ${e.message}`);
        }
      }, 0);
      return "Building your digest — will arrive shortly.";
    }

    return "Unknown /digest subcommand. Try /help digest";
  },
};
