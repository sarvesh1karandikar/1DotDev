import db from "./db.js";

const DEFAULT_TZ_BY_COUNTRY = {
  "1": "America/Los_Angeles",
  "91": "Asia/Kolkata",
};

function guessTz(number) {
  if (number.startsWith("1")) return DEFAULT_TZ_BY_COUNTRY["1"];
  if (number.startsWith("91")) return DEFAULT_TZ_BY_COUNTRY["91"];
  return "UTC";
}

export function ensureUser(number) {
  const row = db.prepare("SELECT * FROM users WHERE number = ?").get(number);
  if (row) return row;
  const tz = guessTz(number);
  db.prepare("INSERT INTO users (number, tz, created_at) VALUES (?, ?, ?)").run(number, tz, Date.now());
  return { number, tz, model: null, created_at: Date.now() };
}

export function setTz(number, tz) {
  db.prepare("UPDATE users SET tz = ? WHERE number = ?").run(tz, number);
}

export function setModel(number, modelId) {
  db.prepare("UPDATE users SET model = ? WHERE number = ?").run(modelId, number);
}

export function getUser(number) {
  return db.prepare("SELECT * FROM users WHERE number = ?").get(number);
}
