import db from "./db.js";

export function appendMessage(number, role, content) {
  db.prepare("INSERT INTO messages (number, role, content, created_at) VALUES (?, ?, ?, ?)").run(
    number, role, content, Date.now()
  );
}

export function recentMessages(number, limit = 20) {
  const rows = db.prepare(
    "SELECT role, content FROM messages WHERE number = ? ORDER BY id DESC LIMIT ?"
  ).all(number, limit);
  return rows.reverse().map(r => ({ role: r.role, content: r.content }));
}

export function clearMessages(number) {
  return db.prepare("DELETE FROM messages WHERE number = ?").run(number).changes;
}

export function messageCount(number) {
  return db.prepare("SELECT COUNT(*) AS n FROM messages WHERE number = ?").get(number).n;
}

export function listFacts(number) {
  return db.prepare("SELECT id, fact FROM facts WHERE number = ? ORDER BY id").all(number);
}

export function addFact(number, fact) {
  return db.prepare("INSERT INTO facts (number, fact, created_at) VALUES (?, ?, ?)").run(
    number, fact, Date.now()
  ).lastInsertRowid;
}

export function removeFactByIndex(number, index) {
  const rows = listFacts(number);
  const target = rows[index - 1];
  if (!target) return false;
  db.prepare("DELETE FROM facts WHERE id = ?").run(target.id);
  return target.fact;
}

export function addEntry(number, kind, content, localDateStr) {
  return db.prepare(
    "INSERT INTO entries (number, kind, content, local_date, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(number, kind, content, localDateStr, Date.now()).lastInsertRowid;
}

export function entriesOn(number, localDateStr, kind) {
  if (kind) {
    return db.prepare(
      "SELECT id, kind, content, created_at FROM entries WHERE number = ? AND local_date = ? AND kind = ? ORDER BY id"
    ).all(number, localDateStr, kind);
  }
  return db.prepare(
    "SELECT id, kind, content, created_at FROM entries WHERE number = ? AND local_date = ? ORDER BY id"
  ).all(number, localDateStr);
}

export function recentEntries(number, kind, limit = 10) {
  return db.prepare(
    "SELECT id, kind, content, local_date, created_at FROM entries WHERE number = ? AND kind = ? ORDER BY id DESC LIMIT ?"
  ).all(number, kind, limit);
}

export function searchEntries(number, query, limit = 20) {
  const q = `%${query}%`;
  return db.prepare(
    "SELECT id, kind, content, local_date, created_at FROM entries WHERE number = ? AND content LIKE ? ORDER BY id DESC LIMIT ?"
  ).all(number, q, limit);
}

export function userCost(number, sinceMs) {
  const row = db.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total, COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output FROM usage WHERE number = ? AND created_at >= ?"
  ).get(number, sinceMs);
  return row;
}

export function costByUser(sinceMs) {
  return db.prepare(
    "SELECT number, COALESCE(SUM(cost_usd), 0) AS total, COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output FROM usage WHERE created_at >= ? GROUP BY number ORDER BY total DESC"
  ).all(sinceMs);
}

// --- Reminders ---

export function addReminder(number, text, dueAt) {
  return db.prepare(
    "INSERT INTO reminders (number, text, due_at, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).run(number, text, dueAt, Date.now()).lastInsertRowid;
}

export function pendingReminders(number) {
  return db.prepare(
    "SELECT id, text, due_at FROM reminders WHERE number = ? AND status = 'pending' ORDER BY due_at"
  ).all(number);
}

export function dueReminders(nowMs) {
  return db.prepare(
    "SELECT id, number, text, due_at FROM reminders WHERE status = 'pending' AND due_at <= ? ORDER BY due_at"
  ).all(nowMs);
}

export function markReminderSent(id, sentAt = Date.now()) {
  db.prepare("UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ?").run(sentAt, id);
}

export function markReminderFailed(id, error) {
  db.prepare("UPDATE reminders SET status = 'failed', error = ? WHERE id = ?").run(error, id);
}

export function cancelReminder(number, index) {
  const rows = pendingReminders(number);
  const target = rows[index - 1];
  if (!target) return null;
  db.prepare("UPDATE reminders SET status = 'cancelled' WHERE id = ?").run(target.id);
  return target;
}

export function reminderStats() {
  return db.prepare(
    "SELECT status, COUNT(*) AS n FROM reminders GROUP BY status"
  ).all();
}

// --- Todos ---

export function addTodo(number, text) {
  return db.prepare(
    "INSERT INTO todos (number, text, done, created_at) VALUES (?, ?, 0, ?)"
  ).run(number, text, Date.now()).lastInsertRowid;
}

export function listTodos(number, includeDone = false) {
  const sql = includeDone
    ? "SELECT id, text, done, created_at, completed_at FROM todos WHERE number = ? ORDER BY done, id"
    : "SELECT id, text, done, created_at FROM todos WHERE number = ? AND done = 0 ORDER BY id";
  return db.prepare(sql).all(number);
}

export function markTodoDone(number, index) {
  const rows = listTodos(number);
  const target = rows[index - 1];
  if (!target) return null;
  db.prepare("UPDATE todos SET done = 1, completed_at = ? WHERE id = ?").run(Date.now(), target.id);
  return target;
}

export function clearTodos(number) {
  return db.prepare("DELETE FROM todos WHERE number = ?").run(number).changes;
}
