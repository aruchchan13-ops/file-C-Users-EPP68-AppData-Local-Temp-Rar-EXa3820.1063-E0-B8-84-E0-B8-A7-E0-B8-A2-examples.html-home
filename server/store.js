// File-based storage: lessons as JSON, uploads as files with a JSON sidecar.
// No database server or native module needed, so `npm install` works on any OS.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const LESSON_DIR = path.join(DATA_DIR, "lessons");
await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(LESSON_DIR, { recursive: true });

export const newId = () => crypto.randomBytes(12).toString("base64url");
export const isId = id => typeof id === "string" && /^[A-Za-z0-9_-]{8,40}$/.test(id);

async function writeJson(file, obj) {
  const tmp = file + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(obj));
  await fs.rename(tmp, file);
}
async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
}

/* ---------- uploads ---------- */
export async function saveUploadMeta(meta) { await writeJson(path.join(UPLOAD_DIR, meta.id + ".json"), meta); }
export async function getUpload(id) {
  if (!isId(id)) return null;
  const meta = await readJson(path.join(UPLOAD_DIR, id + ".json"));
  if (!meta) return null;
  return { meta, file: path.join(UPLOAD_DIR, meta.stored) };
}
export async function deleteUpload(id) {
  const u = await getUpload(id); if (!u) return;
  await fs.rm(u.file, { force: true }); await fs.rm(path.join(UPLOAD_DIR, id + ".json"), { force: true });
}

/* ---------- lessons ---------- */
export async function getLesson(id) { return isId(id) ? readJson(path.join(LESSON_DIR, id + ".json")) : null; }
export async function saveLesson(lesson) { await writeJson(path.join(LESSON_DIR, lesson.id + ".json"), lesson); }
export async function listLessons() {
  const names = (await fs.readdir(LESSON_DIR)).filter(n => n.endsWith(".json"));
  const all = await Promise.all(names.map(n => readJson(path.join(LESSON_DIR, n))));
  return all.filter(Boolean)
    .map(l => ({ id: l.id, title: l.title, mode: l.mode, lang: l.lang, created: l.created, updated: l.updated, steps: l.stepCount || 0 }))
    .sort((a, b) => b.updated - a.updated);
}
export async function deleteLesson(id) {
  const l = await getLesson(id); if (!l) return false;
  await Promise.all((l.files || []).map(deleteUpload));
  await fs.rm(path.join(LESSON_DIR, id + ".json"), { force: true });
  return true;
}
