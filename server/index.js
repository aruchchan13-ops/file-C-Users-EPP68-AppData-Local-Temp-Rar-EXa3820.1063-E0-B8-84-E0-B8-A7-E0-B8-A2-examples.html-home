// Kru Board server: serves the web app, stores lessons and uploads, and streams the tutor's replies.
try { process.loadEnvFile(); } catch { /* no .env file: use the real environment */ }

import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { rulesFor, parseReply, kindOf, MODES, LANGS, SUBJECTS, LEVELS, TIERS } from "../web/shared.js";
import { newId, isId, saveUploadMeta, getUpload, UPLOAD_DIR, getLesson, saveLesson, listLessons, deleteLesson } from "./store.js";
import { streamTutor, buildMessages, getClient, MODEL, TutorError } from "./claude.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(ROOT, "..", "web");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PASSWORD = process.env.APP_PASSWORD || "";

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'self'; base-uri 'none'"
  });
  next();
});

/* ---------- web app ---------- */
app.get(["/", "/index.html"], async (req, res) => {
  const body = await fs.readFile(path.join(WEB, "app.html"), "utf8");
  res.type("html").send(`<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
});
app.use(express.static(WEB, { index: false, maxAge: 0 }));

/* ---------- auth (only when APP_PASSWORD is set) ---------- */
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
app.get("/api/health", (req, res) => {
  let ready = true; try { getClient(); } catch { ready = false; }
  res.json({ ok: true, model: MODEL, ready, auth: !!PASSWORD });
});
app.use("/api", (req, res, next) => {
  if (!PASSWORD) return next();
  const h = req.get("authorization") || "";
  if (h.startsWith("Bearer ") && safeEq(h.slice(7), PASSWORD)) return next();
  res.status(401).json({ error: "auth" });
});

/* ---------- uploads ---------- */
const KINDS = {
  "image/jpeg": ["image", ".jpg"], "image/png": ["image", ".png"], "image/webp": ["image", ".webp"], "image/gif": ["image", ".gif"],
  "application/pdf": ["pdf", ".pdf"],
  "text/plain": ["text", ".txt"], "text/markdown": ["text", ".md"], "text/csv": ["text", ".csv"]
};
const EXT_TYPE = { ".txt": "text/plain", ".md": "text/markdown", ".markdown": "text/markdown", ".csv": "text/csv", ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const typeOf = f => KINDS[f.mimetype] ? f.mimetype : EXT_TYPE[path.extname(f.originalname || "").toLowerCase()];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, f, cb) => { const id = newId(); f.kbId = id; cb(null, id + KINDS[typeOf(f)][1]); }
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (req, f, cb) => cb(null, !!typeOf(f))
});
app.post("/api/upload", (req, res) => {
  upload.array("files", 10)(req, res, async err => {
    if (err) return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "too_large" : "bad_upload" });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "bad_type" });
    const out = [];
    for (const f of files) {
      const type = typeOf(f), [kind] = KINDS[type];
      if (kind === "image" && f.size > 5 * 1024 * 1024) { await fs.rm(f.path, { force: true }); return res.status(413).json({ error: "image_too_large" }); }
      const raw = f.originalname || "file";
      const name = (/[^\u0000-\u00ff]/.test(raw) ? raw : Buffer.from(raw, "latin1").toString("utf8")).slice(0, 200);
      const meta = { id: f.kbId, name, type, kind, size: f.size, stored: path.basename(f.path), created: Date.now() };
      await saveUploadMeta(meta);
      out.push({ id: meta.id, name, type, kind, size: f.size });
    }
    res.json({ files: out });
  });
});
app.get("/api/files/:id", async (req, res) => {
  const u = await getUpload(req.params.id);
  if (!u) return res.status(404).end();
  res.set({ "Content-Type": u.meta.kind === "text" ? "text/plain; charset=utf-8" : u.meta.type, "Content-Disposition": "inline", "Cache-Control": "private, max-age=86400" });
  res.sendFile(u.file);
});

/* ---------- lessons ---------- */
app.get("/api/lessons", async (req, res) => res.json({ lessons: await listLessons() }));
app.get("/api/lessons/:id", async (req, res) => {
  const l = await getLesson(req.params.id);
  if (!l) return res.status(404).json({ error: "not_found" });
  const fileInfo = {};
  for (const id of l.files || []) { const u = await getUpload(id); if (u) fileInfo[id] = { id, name: u.meta.name, kind: u.meta.kind, type: u.meta.type }; }
  res.json({ lesson: l, files: fileInfo });
});
app.delete("/api/lessons/:id", async (req, res) => res.json({ ok: await deleteLesson(req.params.id) }));

/* ---------- chat (Server-Sent Events) ---------- */
const pick = (v, list, d) => list.includes(v) ? v : d;
app.post("/api/chat", express.json({ limit: "1mb" }), async (req, res) => {
  const b = req.body || {};
  const text = String(b.text || "").slice(0, 20000).trim();
  const fileIds = (Array.isArray(b.fileIds) ? b.fileIds : []).filter(isId).slice(0, 10);
  if (!text && !fileIds.length) return res.status(400).json({ error: "empty" });
  for (const id of fileIds) if (!(await getUpload(id))) return res.status(400).json({ error: "missing_file" });

  let lesson = b.lessonId ? await getLesson(b.lessonId) : null;
  if (!lesson) {
    lesson = { id: newId(), title: "", mode: pick(b.mode, MODES, "topic"), subject: pick(b.subject, SUBJECTS, "auto"), level: pick(b.level, LEVELS, "upper"),
      lang: pick(b.lang, LANGS, "th"), quizN: 8, created: Date.now(), updated: Date.now(), turns: [], files: [], stepCount: 0 };
  }
  lesson.lang = pick(b.lang, LANGS, lesson.lang);
  lesson.quizN = Math.min(20, Math.max(3, Number(b.quizN) || lesson.quizN || 8));
  const userTurn = { role: "user", content: text || "(see the attached files)", display: String(b.display || "").slice(0, 500) || undefined, files: fileIds, at: Date.now() };

  res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableFinished) ac.abort(); });
  const ping = setInterval(() => { if (!res.writableEnded) res.write(": ping\n\n"); }, 15000);
  send("start", { lessonId: lesson.id });

  try {
    const messages = await buildMessages([...lesson.turns, userTurn]);
    const r = await streamTutor({ system: rulesFor(lesson), messages, tier: pick(b.tier, TIERS, "default"), signal: ac.signal, onText: d => send("delta", d) });
    const objs = parseReply(r.text);
    if (!lesson.title) {
      const meta = objs.find(o => kindOf(o) === "meta" && o.title);
      lesson.title = String(meta ? meta.title : (userTurn.display || text || "บทเรียน")).slice(0, 80);
    }
    lesson.turns.push(userTurn, { role: "assistant", content: r.text, at: Date.now() });
    lesson.files.push(...fileIds);
    lesson.stepCount = (lesson.stepCount || 0) + objs.filter(o => kindOf(o) === "step").length;
    lesson.updated = Date.now();
    await saveLesson(lesson);
    send("done", { lessonId: lesson.id, title: lesson.title, truncated: r.truncated });
  } catch (e) {
    const code = e instanceof TutorError ? e.code : "upstream_error";
    if (code !== "cancelled") console.error("[chat]", code, e.message);
    send("error", { code, message: code === "cancelled" ? "" : String(e.message || "").slice(0, 300) });
  } finally {
    clearInterval(ping);
    res.end();
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "not_found" }));

app.listen(PORT, HOST, () => {
  console.log(`ครูกระดาน พร้อมใช้งานที่ http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}  (model: ${MODEL})`);
  if (HOST === "0.0.0.0" && !PASSWORD) console.warn("คำเตือน: เปิดให้เครื่องอื่นในเครือข่ายเข้าได้แต่ยังไม่ได้ตั้ง APP_PASSWORD");
});
