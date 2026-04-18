import db from "./db.js";

export const WELCOME_MESSAGE = `Hi! 👋 I am *1DotDev*, a personal WhatsApp bot built by Sarvesh Karandikar.

You are one of a handful of people with access to me. Here is what I can do:

💬 *Chat* — just message me anything, like ChatGPT
🧠 *Remember things about you* — /remember I am vegetarian
📓 *Journal* — /journal had a great day today
🗒️ *Notes* — /note pick up milk, then /notes to see them
📅 *Log past events* — /entry 2026-04-14 went running
🔍 *Search* — /recall broken AC
🌍 *Timezone helper* — /time
💰 *See usage* — /cost

Type */help* for the full list.

Ready when you are.`;

export function isGreeted(number) {
  const row = db.prepare("SELECT greeted_at FROM users WHERE number = ?").get(number);
  return !!row?.greeted_at;
}

export function markGreeted(number) {
  db.prepare("UPDATE users SET greeted_at = ? WHERE number = ? AND greeted_at IS NULL").run(Date.now(), number);
}
