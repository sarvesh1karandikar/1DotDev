import axios from "axios";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function sendText(to, text) {
  const { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID } = process.env;
  await axios.post(
    `${GRAPH_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: { Authorization: `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" } }
  );
}

export async function sendTemplate(to, templateName, language, bodyParams = []) {
  const { META_WA_TOKEN, META_WA_PHONE_NUMBER_ID } = process.env;
  const components = bodyParams.length > 0
    ? [{
        type: "body",
        parameters: bodyParams.map(p => ({ type: "text", text: p })),
      }]
    : [];
  await axios.post(
    `${GRAPH_BASE}/${META_WA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: templateName, language: { code: language }, components },
    },
    { headers: { Authorization: `Bearer ${META_WA_TOKEN}`, "Content-Type": "application/json" } }
  );
}
