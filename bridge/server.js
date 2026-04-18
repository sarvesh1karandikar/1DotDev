import "dotenv/config";
import { loadSecretsFromSsm } from "./lib/secrets.js";
await loadSecretsFromSsm();

import express from "express";
import crypto from "crypto";
import { createClient, logUsage } from "./lib/anthropic.js";
import { ensureUser } from "./lib/users.js";
import { appendMessage, recentMessages, listFacts } from "./lib/state.js";
import { WELCOME_MESSAGE, isGreeted, markGreeted } from "./lib/welcome.js";
import { sendText as sendWhatsApp } from "./lib/whatsapp.js";
import { start as startScheduler } from "./lib/scheduler.js";
import { routeMessage } from "./lib/router.js";
import { commands, byName } from "./commands/index.js";

const {
  META_WA_TOKEN,
  META_WA_PHONE_NUMBER_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  META_APP_SECRET,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL = "claude-haiku-4-5",
  ALLOWED_WHATSAPP_NUMBERS = "",
  ADMIN_WHATSAPP_NUMBERS = "",
  PORT = 3000,
} = process.env;

const required = { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID, META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, ANTHROPIC_API_KEY };
for (const [k, v] of Object.entries(required)) if (!v) { console.error("missing env:", k); process.exit(1); }

const allowlist = new Set(ALLOWED_WHATSAPP_NUMBERS.split(",").map(s => s.trim().replace(/^\+/, "")).filter(Boolean));
const admins = new Set(ADMIN_WHATSAPP_NUMBERS.split(",").map(s => s.trim().replace(/^\+/, "")).filter(Boolean));
console.log("allowlist:", allowlist.size, "admins:", admins.size);

const anthropic = createClient(ANTHROPIC_API_KEY);
const app = express();

app.use("/webhook", express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.json());

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
    console.log("webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

function validSignature(req) {
  const header = req.get("x-hub-signature-256");
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", META_APP_SECRET).update(req.rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

function systemPromptFor(number) {
  const facts = listFacts(number).map(f => `- ${f.fact}`).join("\n");
  const base = "You are a helpful personal assistant replying over WhatsApp. Keep replies concise.";
  if (!facts) return base;
  return `${base}\n\nFacts the user has told you to remember:\n${facts}`;
}

async function runCommand(name, args, ctx) {
  const cmd = byName.get(name);
  if (!cmd) return `Unknown command /${name}. Try /help.`;
  if (cmd.adminOnly && !ctx.isAdmin) return `/${name} is admin-only.`;
  try {
    return await cmd.run({ ...ctx, args, commands });
  } catch (e) {
    console.error("command error:", name, e);
    return `Error running /${name}.`;
  }
}

async function handleCommand(text, ctx) {
  const m = text.trim().match(/^\/(\S+)\s*(.*)$/s);
  if (!m) return null;
  return runCommand(m[1].toLowerCase(), m[2] ?? "", ctx);
}

// Translate a router tool call into an existing command invocation.
// Returns { cmdName, args, prefix } or null if the tool cannot be mapped.
function toolToCommand(toolName, input) {
  switch (toolName) {
    case "remind":
      return { cmdName: "remind", args: `${input.when} ${input.text}`.trim(), prefix: "⏱" };
    case "todo_add":
      return { cmdName: "todo", args: `add ${input.text}`, prefix: "✅" };
    case "todo_list":
      return { cmdName: "todo", args: "list", prefix: "📋" };
    case "todo_done":
      return { cmdName: "todo", args: `done ${input.index}`, prefix: "✅" };
    case "reminders_list":
      return { cmdName: "reminders", args: "", prefix: "⏰" };
    case "time":
      return { cmdName: "time", args: "", prefix: "🕐" };
    case "reset":
      return { cmdName: "reset", args: "", prefix: "🧹" };
    case "digest_add":
      return { cmdName: "digest", args: `add ${input.topic}`, prefix: "📰" };
    case "digest_remove":
      return { cmdName: "digest", args: `remove ${input.index}`, prefix: "📰" };
    case "digest_now":
      return { cmdName: "digest", args: "now", prefix: "📰" };
    case "digest_status":
      return { cmdName: "digest", args: "", prefix: "📰" };
    default:
      return null;
  }
}

app.post("/webhook", async (req, res) => {
  if (!validSignature(req)) { console.warn("signature check failed"); return res.sendStatus(401); }
  res.sendStatus(200);
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg || msg.type !== "text") return;
    const from = msg.from;
    const text = msg.text.body;

    if (!allowlist.has(from)) {
      console.log("dropped (not allowlisted):", from);
      return;
    }
    const user = ensureUser(from);
    const isAdmin = admins.has(from);
    console.log("in:", from, text);

    if (!isGreeted(from)) {
      await sendWhatsApp(from, WELCOME_MESSAGE);
      markGreeted(from);
      console.log("welcomed:", from);
      return;
    }

    if (text.trim().startsWith("/")) {
      const reply = await handleCommand(text, { from, user, isAdmin });
      if (reply) {
        await sendWhatsApp(from, reply);
        console.log("cmd out:", from, reply.slice(0, 80));
      }
      return;
    }

    // Natural-language routing: ask Haiku to pick a tool or defer to chat.
    try {
      const decision = await routeMessage(anthropic, text);
      if (decision.usage) logUsage(from, "claude-haiku-4-5", decision.usage);
      if (decision.kind === "tool") {
        const mapping = toolToCommand(decision.name, decision.input);
        if (mapping) {
          console.log(`routed: ${decision.name} ${JSON.stringify(decision.input)}`);
          const out = await runCommand(mapping.cmdName, mapping.args, { from, user, isAdmin });
          const reply = `${mapping.prefix} ${out}`;
          await sendWhatsApp(from, reply);
          console.log("route out:", from, reply.slice(0, 80));
          return;
        }
      }
    } catch (e) {
      console.warn("router failed, falling through to chat:", e.message);
    }

    appendMessage(from, "user", text);
    const messages = recentMessages(from, 20);
    const system = systemPromptFor(from);

    const resp = await anthropic.messages.create({
      model: user.model || ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages,
    });
    logUsage(from, user.model || ANTHROPIC_MODEL, resp.usage);
    const reply = resp.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "(no reply)";
    appendMessage(from, "assistant", reply);

    await sendWhatsApp(from, reply);
    console.log("out:", from, reply.slice(0, 80));
  } catch (e) {
    console.error("handler error:", e.response?.data || e.message);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`bridge listening on :${PORT}`);
  startScheduler();
});
