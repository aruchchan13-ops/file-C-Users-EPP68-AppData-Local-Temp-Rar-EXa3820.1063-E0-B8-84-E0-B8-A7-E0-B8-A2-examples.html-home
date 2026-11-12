// Talks to the Claude API. The API key stays on the server (ANTHROPIC_API_KEY in .env).
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import { getUpload } from "./store.js";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
// Models that accept server-side refusal fallbacks in their "default" form.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1"]);
const EFFORT = { quick: "low", default: "medium", complex: "high" };

let client = null;
export function getClient() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)
  return client;
}

export class TutorError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

// Turn the stored conversation into Messages API turns, attaching each user turn's files.
export async function buildMessages(turns) {
  const keep = turns.length > 17 ? [turns[0], { role: "assistant", content: "(earlier conversation omitted)" }, ...turns.slice(-16)] : turns;
  const out = [];
  for (const t of keep) {
    let content;
    if (t.role === "user" && t.files && t.files.length) {
      const blocks = [];
      for (const id of t.files) {
        const u = await getUpload(id);
        if (!u) { blocks.push({ type: "text", text: "[an attached file is no longer available]" }); continue; }
        const buf = await fs.readFile(u.file);
        if (u.meta.kind === "image") blocks.push({ type: "image", source: { type: "base64", media_type: u.meta.type, data: buf.toString("base64") } });
        else if (u.meta.kind === "pdf") blocks.push({ type: "document", title: u.meta.name.slice(0, 200), source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
        else blocks.push({ type: "document", title: u.meta.name.slice(0, 200), source: { type: "text", media_type: "text/plain", data: buf.toString("utf8").slice(0, 400000) || "(empty file)" } });
      }
      blocks.push({ type: "text", text: t.content });
      content = blocks;
    } else content = t.content;
    const last = out[out.length - 1];
    if (last && last.role === t.role) {
      // merge consecutive turns of the same role (e.g. after a failed request)
      const asBlocks = c => typeof c === "string" ? [{ type: "text", text: c }] : c;
      last.content = [...asBlocks(last.content), ...asBlocks(content)];
    } else out.push({ role: t.role, content });
  }
  if (out.length && out[0].role !== "user") out.unshift({ role: "user", content: "(continuing the lesson)" });
  return out;
}

export async function streamTutor({ system, messages, tier, signal, onText }) {
  let c;
  try { c = getClient(); } catch (e) { throw new TutorError("no_key", e.message); }
  const params = {
    model: MODEL,
    max_tokens: 16000,
    system,
    messages,
    cache_control: { type: "ephemeral" },
    output_config: { effort: EFFORT[tier] || "medium" }
  };
  if (FALLBACK_MODELS.has(MODEL)) { params.betas = ["server-side-fallback-2026-07-01"]; params.fallbacks = "default"; }
  try {
    const stream = c.beta.messages.stream(params, { signal });
    stream.on("text", d => onText(d));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new TutorError("refused");
    const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    return { text, truncated: msg.stop_reason === "max_tokens", usage: msg.usage };
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if (e instanceof Anthropic.APIUserAbortError || (signal && signal.aborted)) throw new TutorError("cancelled");
    if (e instanceof Anthropic.AuthenticationError) throw new TutorError("bad_key", e.message);
    if (e instanceof Anthropic.PermissionDeniedError) throw new TutorError("bad_key", e.message);
    if (e instanceof Anthropic.RateLimitError) throw new TutorError("rate_limited", e.message);
    if (e instanceof Anthropic.BadRequestError) throw new TutorError("bad_request", e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new TutorError("network", e.message);
    if (e instanceof Anthropic.APIError) throw new TutorError(e.status === 529 ? "overloaded" : e.status === 413 ? "too_large" : "upstream_error", e.message);
    if (e instanceof Anthropic.AnthropicError) throw new TutorError("no_key", e.message);
    throw new TutorError("upstream_error", String(e && e.message || e));
  }
}
