import { addTodo, listTodos, markTodoDone, clearTodos } from "../lib/state.js";

function render(rows) {
  if (rows.length === 0) return "No todos. Add one with /todo add <text>.";
  const lines = ["*Your todos*"];
  rows.forEach((r, i) => {
    const check = r.done ? "✓" : " ";
    lines.push(`${i + 1}. [${check}] ${r.text}`);
  });
  return lines.join("\n");
}

export default {
  name: "todo",
  adminOnly: false,
  category: "reminders",
  description: "Manage your todo list",
  usage: "/todo add <text> | /todo list | /todo done <n> | /todo clear",
  examples: [
    "/todo add buy groceries",
    "/todo list",
    "/todo done 2",
  ],
  async run({ from, args }) {
    const a = args.trim();

    if (a === "" || a === "list") {
      return render(listTodos(from));
    }
    if (a.startsWith("add ")) {
      const text = a.slice(4).trim();
      if (!text) return "Usage: /todo add <text>";
      addTodo(from, text);
      return render(listTodos(from));
    }
    if (a.startsWith("done ")) {
      const n = parseInt(a.split(/\s+/)[1], 10);
      if (!Number.isFinite(n) || n < 1) return "Usage: /todo done <n>";
      const done = markTodoDone(from, n);
      if (!done) return `No todo #${n}. Run /todo to see the list.`;
      return `✓ Marked done: "${done.text}"\n\n${render(listTodos(from))}`;
    }
    if (a === "clear") {
      const n = clearTodos(from);
      return `Cleared ${n} todo(s).`;
    }
    return "Usage: /todo add <text> | /todo list | /todo done <n> | /todo clear";
  },
};
