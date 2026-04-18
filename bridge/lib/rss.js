import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const FETCH_TIMEOUT_MS = 5000;

function googleNewsUrl(topic) {
  const q = encodeURIComponent(topic);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

export async function fetchTopic(topic, { limit = 5 } = {}) {
  const url = googleNewsUrl(topic);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "1DotDev-bot/1.0 (+https://github.com/sarvesh1karandikar/1DotDev)" },
    });
    if (!resp.ok) return { topic, items: [], error: `HTTP ${resp.status}` };
    const xml = await resp.text();
    const parsed = parser.parse(xml);
    const raw = parsed?.rss?.channel?.item ?? [];
    const arr = Array.isArray(raw) ? raw : [raw];
    const items = arr.slice(0, limit).map(i => ({
      title: (i.title ?? "").toString().replace(/\s+-\s+[^-]+$/, "").trim(),
      source: (i.source?.["#text"] ?? i.source ?? "").toString(),
      link: (i.link ?? "").toString(),
      published: (i.pubDate ?? "").toString(),
      summary: stripHtml((i.description ?? "").toString()).slice(0, 400),
    })).filter(i => i.title);
    return { topic, items };
  } catch (e) {
    return { topic, items: [], error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAll(topics, opts = {}) {
  return Promise.all(topics.map(t => fetchTopic(t, opts)));
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
