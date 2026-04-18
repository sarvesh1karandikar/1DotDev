import cron from "node-cron";
import db from "./db.js";
import { dueReminders, markReminderSent, markReminderFailed } from "./state.js";
import { sendText, sendTemplate } from "./whatsapp.js";
import { allEnabledSubscriptions, isDue, sendDigestFor } from "./digest.js";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_NAME = "reminder_notification";
const TEMPLATE_LANG = "en";

function lastInboundMs(number) {
  const row = db.prepare(
    "SELECT MAX(created_at) AS last FROM messages WHERE number = ? AND role = 'user'"
  ).get(number);
  return row?.last ?? 0;
}

export async function fireReminder(rem) {
  const inWindow = (Date.now() - lastInboundMs(rem.number)) < WINDOW_MS;
  try {
    if (inWindow) {
      await sendText(rem.number, `🔔 Reminder: ${rem.text}`);
    } else {
      await sendTemplate(rem.number, TEMPLATE_NAME, TEMPLATE_LANG, [rem.text]);
    }
    markReminderSent(rem.id);
    console.log(`reminder #${rem.id} sent (${inWindow ? "free-form" : "template"}) to ${rem.number}`);
    return { ok: true, mode: inWindow ? "free-form" : "template" };
  } catch (e) {
    const detail = e.response?.data?.error?.message ?? e.message;
    markReminderFailed(rem.id, detail);
    console.error(`reminder #${rem.id} failed: ${detail}`);
    return { ok: false, error: detail };
  }
}

export async function tick() {
  const now = Date.now();
  const due = dueReminders(now);
  if (due.length > 0) {
    console.log(`scheduler: ${due.length} reminder(s) due`);
    for (const rem of due) {
      await fireReminder(rem);
    }
  }

  const subs = allEnabledSubscriptions();
  const dueSubs = subs.filter(s => s.topics.length > 0 && isDue(s, new Date(now)));
  if (dueSubs.length > 0) {
    console.log(`scheduler: ${dueSubs.length} digest(s) due`);
    for (const sub of dueSubs) {
      await sendDigestFor(sub);
    }
  }
}

export function start() {
  // Every minute on the minute.
  cron.schedule("* * * * *", () => {
    tick().catch(e => console.error("scheduler tick crashed:", e));
  });
  console.log("scheduler started (checks every minute)");
}
