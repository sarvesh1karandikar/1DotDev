// Natural-language router: asks Haiku to pick a tool or fall through to chat.
// Returns { kind: "tool", name, input } | { kind: "chat" }.

const TOOLS = [
  {
    name: "remind",
    description:
      "Create a reminder for the user. Use ONLY when the user is clearly asking you to remind them of something at a future time. Do NOT use for conversational mentions of reminders.",
    input_schema: {
      type: "object",
      properties: {
        when: {
          type: "string",
          description:
            "Natural-language time expression, e.g. 'tomorrow 3pm', 'in 2 hours', '2026-04-25 09:00'. Keep the user's original phrasing.",
        },
        text: {
          type: "string",
          description: "What the user wants to be reminded of, concise.",
        },
      },
      required: ["when", "text"],
    },
  },
  {
    name: "todo_add",
    description: "Add an item to the user's todo list.",
    input_schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "todo_list",
    description: "Show the user's pending todos.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "todo_done",
    description: "Mark a todo as done by its list number (from /todo list).",
    input_schema: {
      type: "object",
      properties: { index: { type: "integer", minimum: 1 } },
      required: ["index"],
    },
  },
  {
    name: "reminders_list",
    description: "Show the user's upcoming reminders.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "time",
    description:
      "Show the current time in the user's timezone plus the other region (LA/IST). Use only if the user asks about the current time.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "reset",
    description: "Clear the chat history. Use ONLY on an explicit request like 'clear my history' or 'reset our chat'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "chat",
    description:
      "Default. Use for any request that is a normal conversation, question, story, emotion, or anything not clearly one of the other tools. When in doubt, pick this.",
    input_schema: { type: "object", properties: {} },
  },
];

const ROUTER_SYSTEM = `You route a single incoming WhatsApp message into exactly one tool. You never generate reply text yourself.

Rules:
- If the user is clearly asking for an action that matches a tool, call that tool with precise arguments.
- If the message is conversational, ambiguous, emotional, or any kind of chat — pick the "chat" tool.
- Prefer "chat" when unsure. Misrouting is worse than falling through.
- Do not combine multiple tools. Pick exactly one.
- Preserve the user's original words for free-form fields like reminder text.`;

export async function routeMessage(anthropic, userMessage) {
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: ROUTER_SYSTEM,
    tools: TOOLS,
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = resp.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.name === "chat") {
    return { kind: "chat", usage: resp.usage };
  }
  return { kind: "tool", name: toolUse.name, input: toolUse.input ?? {}, usage: resp.usage };
}
