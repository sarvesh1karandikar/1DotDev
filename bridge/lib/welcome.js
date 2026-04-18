import db from "./db.js";

export const WELCOME_MESSAGE = `Hi! 👋 I am *1DotDev*, a personal WhatsApp bot built by Sarvesh Karandikar.

You are one of a handful of people with access to me. Here is what I can do:

💬 *Chat* — just message me anything, like ChatGPT
📅 *Set reminders* — /remind tomorrow 3pm call mom
✅ *Track todos* — /todo add buy groceries
🕐 *Time across regions* — /time

Type */help* for all commands.

Ready when you are.`;

export function isGreeted(number) {
  const row = db.prepare("SELECT greeted_at FROM users WHERE number = ?").get(number);
  return !!row?.greeted_at;
}

export function markGreeted(number) {
  db.prepare("UPDATE users SET greeted_at = ? WHERE number = ? AND greeted_at IS NULL").run(Date.now(), number);
}
