// Kru Board frontend. Runs against the bundled Node server (npm start) or, when opened
// inside the Claude app as an Artifact, against the viewer's own Claude account.
import { DICT } from "./i18n.js";
import { rulesFor, lineFeeder, parseReply, kindOf } from "./shared.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (typeof v === "number" && isFinite(v)) ? v : (isFinite(parseFloat(v)) ? parseFloat(v) : d);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ================= settings & i18n ================= */
const S = Object.assign({ ui: "th", lang: "th", mode: "topic", subject: "auto", level: "upper", voiceTh: "", voiceEn: "", claudeVoice: "buttery", rate: 1, tier: "default", voiceOn: true, quizN: "8", pw: "" }, store.get("kb2-settings", {}));
if (!["th", "en"].includes(S.ui)) S.ui = "th";
if (!["th", "en"].includes(S.lang)) S.lang = S.ui;
if (!["topic", "homework", "exam", "chat"].includes(S.mode)) S.mode = "topic";
const saveS = () => store.set("kb2-settings", S);
function t(key, vars) {
  let s = DICT[S.ui][key] ?? DICT.th[key] ?? key;
  if (vars && typeof s === "string") s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return s;
}

/* ================= mini TeX ================= */
const SYM = { times:"×", div:"÷", pm:"±", mp:"∓", le:"≤", leq:"≤", ge:"≥", geq:"≥", ne:"≠", neq:"≠", approx:"≈", equiv:"≡", sim:"∼", propto:"∝",
  pi:"π", theta:"θ", alpha:"α", beta:"β", gamma:"γ", Gamma:"Γ", delta:"δ", Delta:"Δ", lambda:"λ", mu:"μ", sigma:"σ", Sigma:"Σ", omega:"ω", Omega:"Ω", phi:"φ", varphi:"φ", Phi:"Φ", rho:"ρ", epsilon:"ε", varepsilon:"ε", tau:"τ", eta:"η", kappa:"κ", nu:"ν", psi:"ψ", chi:"χ", xi:"ξ", zeta:"ζ",
  to:"→", rightarrow:"→", leftarrow:"←", Rightarrow:"⇒", Leftarrow:"⇐", iff:"⇔", Leftrightarrow:"⇔", leftrightarrow:"↔", rightleftharpoons:"⇌", uparrow:"↑", downarrow:"↓", implies:"⇒",
  cdot:"·", degree:"°", circ:"°", infty:"∞", sum:"Σ", prod:"Π", int:"∫", oint:"∮", partial:"∂", nabla:"∇", therefore:"∴", because:"∵", angle:"∠", triangle:"△", perp:"⊥", parallel:"∥",
  in:"∈", notin:"∉", cup:"∪", cap:"∩", subset:"⊂", subseteq:"⊆", supset:"⊃", emptyset:"∅", varnothing:"∅", forall:"∀", exists:"∃", neg:"¬", land:"∧", lor:"∨", ldots:"…", cdots:"⋯", dots:"…",
  quad:" ", qquad:"  ", ",":" ", ";":" ", ":":" ", "!":"", " ":" ", "%":"%", "$":"$", "{":"{", "}":"}", "#":"#", "&":"&", "_":"_", "|":"‖",
  sin:"sin", cos:"cos", tan:"tan", cot:"cot", sec:"sec", csc:"csc", log:"log", ln:"ln", lim:"lim", max:"max", min:"min", exp:"exp", det:"det",
  left:"", right:"", big:"", Big:"", bigg:"", displaystyle:"", limits:"", nolimits:"", ell:"ℓ", hbar:"ħ", prime:"′", star:"⋆", ast:"∗", bullet:"•", checkmark:"✓" };
function tex(src) {
  src = String(src ?? ""); let i = 0;
  const skipSp = () => { while (src[i] === " ") i++; };
  function rawGroup() { skipSp(); if (src[i] !== "{") return src[i++] || ""; i++; let d = 1, s = ""; while (i < src.length) { const c = src[i++]; if (c === "{") d++; else if (c === "}") { if (!--d) break; } s += c; } return s; }
  function group() { skipSp(); if (src[i] === "{") { i++; return seq("}"); } if (src[i] === "\\") return cmd(); const c = src[i++]; return c == null ? "" : esc(c); }
  function cmd() {
    i++; let name = "";
    if (/[a-zA-Z]/.test(src[i] || "")) { while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++]; }
    else name = src[i++] || "";
    switch (name) {
      case "\\": return "<br>";
      case "frac": case "dfrac": case "tfrac": case "cfrac": { const a = group(), b = group(); return `<span class="frac"><span class="num">${a}</span><span class="den">${b}</span></span>`; }
      case "sqrt": { let idx = ""; skipSp(); if (src[i] === "[") { i++; let s = ""; while (i < src.length && src[i] !== "]") s += src[i++]; i++; idx = `<sup class="root-i">${tex(s)}</sup>`; } const r = group(); return `${idx}<span class="sqrt"><span>√</span><span class="rc">${r}</span></span>`; }
      case "text": case "textrm": case "mathrm": case "operatorname": case "mbox": case "textit": case "mathit": return esc(rawGroup());
      case "textbf": case "mathbf": case "boldsymbol": case "bm": return `<b>${group()}</b>`;
      case "overline": case "bar": case "widebar": return `<span class="ovl">${group()}</span>`;
      case "vec": case "overrightarrow": return `<span class="vec">${group()}</span>`;
      case "hat": case "widehat": return `${group()}̂`;
      case "dot": return `${group()}̇`;
      case "underline": return `<u>${group()}</u>`;
      case "boxed": case "fbox": return `<span class="boxed">${group()}</span>`;
      case "color": case "textcolor": rawGroup(); return group();
      case "ce": return tex(rawGroup().replace(/([A-Za-z)])(\d+)/g, "$1_{$2}").replace(/->/g, "\\to "));
      default: return Object.prototype.hasOwnProperty.call(SYM, name) ? esc(SYM[name]) : esc(name);
    }
  }
  function seq(end) {
    let out = "";
    while (i < src.length) {
      const c = src[i];
      if (end && c === end) { i++; return out; }
      if (c === "\\") out += cmd();
      else if (c === "^") { i++; out += `<sup>${group()}</sup>`; }
      else if (c === "_") { i++; out += `<sub>${group()}</sub>`; }
      else if (c === "{") { i++; out += seq("}"); }
      else if (c === "}") i++;
      else if (c === "*") { out += "×"; i++; }
      else { out += esc(c); i++; }
    }
    return out;
  }
  return seq(null);
}
function plain(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); }
function rich(s) {
  s = String(s ?? ""); let out = "", last = 0, m;
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)/g;
  while ((m = re.exec(s))) { out += plain(s.slice(last, m.index)); out += `<span class="mx">${tex(m[1] ?? m[2] ?? m[3])}</span>`; last = re.lastIndex; }
  return out + plain(s.slice(last));
}
const looksTex = s => /\\[a-zA-Z]|[\^_{}]/.test(s);
function speechText(s) {
  const over = S.lang === "en" ? " over " : " ส่วน ";
  return String(s ?? "").replace(/\$([^$]*)\$/g, (_, m) => m).replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, `$1${over}$2`)
    .replace(/\\[a-zA-Z]+/g, m => SYM[m.slice(1)] || " ").replace(/[{}*_#`]/g, "").replace(/\s+/g, " ").trim();
}

/* ================= safe expression parser for plots ================= */
const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, sinh: Math.sinh, cosh: Math.cosh };
const NAMES = ["asin", "acos", "atan", "sinh", "cosh", "sqrt", "floor", "ceil", "sin", "cos", "tan", "abs", "exp", "log", "ln", "pi", "x", "e"];
function compileFn(expr) {
  const s = String(expr).toLowerCase().replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=/, "").replace(/\\cdot|\\times|×|·/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/\*\*/g, "^")
    .replace(/π|\\pi/g, "pi").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√|\\sqrt/g, "sqrt").replace(/[{}]/g, m => m === "{" ? "(" : ")").replace(/\|([^|]+)\|/g, "abs($1)").replace(/\s+/g, "");
  const toks = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) { let n = ""; while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++]; toks.push({ t: "n", v: parseFloat(n) }); continue; }
    if (/[a-z]/.test(c)) { const nm = NAMES.find(n => s.startsWith(n, i)); if (!nm) throw new Error("name"); i += nm.length; toks.push(nm in FN ? { t: "f", v: nm } : { t: "id", v: nm }); continue; }
    if ("+-*/^()".includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new Error("char " + c);
  }
  let p = 0;
  const pk = () => toks[p], nx = () => toks[p++];
  const startsAtom = tk => tk && (tk.t === "n" || tk.t === "id" || tk.t === "f" || tk.t === "(");
  function add() { let a = mul(); while (pk() && (pk().t === "+" || pk().t === "-")) { const op = nx().t, b = mul(), l = a; a = op === "+" ? x => l(x) + b(x) : x => l(x) - b(x); } return a; }
  function mul() { let a = unary(); for (;;) { const tk = pk(); if (tk && (tk.t === "*" || tk.t === "/")) { nx(); const b = unary(), l = a; a = tk.t === "*" ? x => l(x) * b(x) : x => l(x) / b(x); } else if (startsAtom(tk)) { const b = pow(), l = a; a = x => l(x) * b(x); } else return a; } }
  function unary() { const tk = pk(); if (tk && tk.t === "-") { nx(); const a = unary(); return x => -a(x); } if (tk && tk.t === "+") { nx(); return unary(); } return pow(); }
  function pow() { const b = atom(); if (pk() && pk().t === "^") { nx(); const e = unary(); return x => Math.pow(b(x), e(x)); } return b; }
  function atom() {
    const tk = nx(); if (!tk) throw new Error("end");
    if (tk.t === "n") { const v = tk.v; return () => v; }
    if (tk.t === "id") { if (tk.v === "x") return x => x; const v = tk.v === "pi" ? Math.PI : Math.E; return () => v; }
    if (tk.t === "f") { const f = FN[tk.v]; const a = pk() && pk().t === "(" ? atom() : pow(); return x => f(a(x)); }
    if (tk.t === "(") { const a = add(); if (pk() && pk().t === ")") nx(); return a; }
    throw new Error("tok");
  }
  const f = add(); if (p < toks.length) throw new Error("rest");
  return f;
}
function niceStep(range) { const raw = range / 8, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag; }
const fmtN = v => String(Math.round(v * 1000) / 1000).replace("-", "−");
const COLS = ["b", "r", "g", "y", "k"];
const colKey = c => ({ k: "k", b: "b", r: "r", g: "g", y: "y", black: "k", blue: "b", red: "r", green: "g", yellow: "y", amber: "y", orange: "y", white: "k" }[String(c || "k").toLowerCase()] || "k");

let plotSeq = 0;
function plotSVG(el) {
  const W = 440, H = 290, P = 30, cid = "kbclip" + (++plotSeq);
  const fns = (Array.isArray(el.fns) ? el.fns : (el.fn ? [el.fn] : [])).slice(0, 5);
  const comp = fns.map(f => { try { return compileFn(f); } catch { return null; } });
  let [x0, x1] = Array.isArray(el.x) && el.x.length === 2 ? el.x.map(Number) : [-10, 10];
  if (!(x1 > x0)) { x0 = -10; x1 = 10; }
  const N = 360, samples = comp.map(f => { const a = []; for (let k = 0; k <= N; k++) { const x = x0 + (x1 - x0) * k / N; let y = NaN; if (f) { try { y = f(x); } catch { /* skip */ } } a.push([x, y]); } return a; });
  let y0, y1;
  if (Array.isArray(el.y) && el.y.length === 2 && Number(el.y[1]) > Number(el.y[0])) [y0, y1] = el.y.map(Number);
  else {
    const ys = samples.flat().map(q => q[1]).filter(isFinite).sort((a, b) => a - b);
    if (ys.length) { y0 = ys[Math.floor(ys.length * .03)]; y1 = ys[Math.floor(ys.length * .97)]; } else { y0 = -10; y1 = 10; }
    (el.pts || []).forEach(q => { if (Array.isArray(q) && isFinite(q[1])) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); } });
    if (y0 > 0) y0 = 0;
    if (y1 < 0) y1 = 0;
    if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * .1; y0 -= pad; y1 += pad;
  }
  const sx = x => P + (x - x0) / (x1 - x0) * (W - 2 * P), sy = y => H - P - (y - y0) / (y1 - y0) * (H - 2 * P);
  let g = "";
  const stx = niceStep(x1 - x0), sty = niceStep(y1 - y0);
  for (let v = Math.ceil(x0 / stx) * stx; v <= x1 + 1e-9; v += stx) { g += `<line class="grid" x1="${sx(v)}" y1="${P}" x2="${sx(v)}" y2="${H - P}"/>`; if (Math.abs(v) > 1e-9) g += `<text class="tick" x="${sx(v)}" y="${clamp(sy(0) + 14, P + 10, H - P + 14)}" text-anchor="middle">${fmtN(v)}</text>`; }
  for (let v = Math.ceil(y0 / sty) * sty; v <= y1 + 1e-9; v += sty) { g += `<line class="grid" x1="${P}" y1="${sy(v)}" x2="${W - P}" y2="${sy(v)}"/>`; if (Math.abs(v) > 1e-9) g += `<text class="tick" x="${clamp(sx(0) - 5, P - 4, W - P)}" y="${sy(v) + 4}" text-anchor="end">${fmtN(v)}</text>`; }
  const ax = clamp(sy(0), P, H - P), ay = clamp(sx(0), P, W - P);
  g += `<line class="axis" x1="${P}" y1="${ax}" x2="${W - P + 8}" y2="${ax}"/><line class="axis" x1="${ay}" y1="${H - P}" x2="${ay}" y2="${P - 8}"/>`;
  g += `<text class="tick" x="${W - P + 10}" y="${ax + 4}">x</text><text class="tick" x="${ay + 5}" y="${P - 10}">y</text>`;
  let curves = "", legend = "";
  samples.forEach((pts, j) => {
    const c = COLS[j % COLS.length]; let d = "", pen = false, prevY = null;
    const lim = (y1 - y0) * 3;
    for (const [x, y] of pts) {
      if (!isFinite(y) || y < y0 - lim || y > y1 + lim || (prevY !== null && Math.abs(y - prevY) > (y1 - y0) * 1.5)) { pen = false; prevY = isFinite(y) ? y : null; continue; }
      d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(y).toFixed(1); pen = true; prevY = y;
    }
    if (d) curves += `<path class="draw sv-${c}" pathLength="1" d="${d}" fill="none" stroke-width="2.6" stroke-linecap="round" style="--dl:${j * 500}ms;--d:900ms"/>`;
    legend += `<text class="fadein tf-${c}" x="${P + 8}" y="${P + 4 + j * 19}" font-size="15" style="--dl:${j * 500}ms">y = ${esc(String(fns[j]).replace(/^\s*y\s*=\s*/, ""))}</text>`;
  });
  let pts = "";
  (Array.isArray(el.pts) ? el.pts : []).slice(0, 8).forEach((q, j) => {
    if (!Array.isArray(q) || !isFinite(q[0]) || !isFinite(q[1])) return;
    const X = sx(+q[0]), Y = sy(+q[1]);
    pts += `<circle class="fadein tf-r" cx="${X}" cy="${Y}" r="4.5" style="--dl:${900 + j * 200}ms"/>`;
    if (q[2]) pts += `<text class="fadein tf-r" x="${X + 8}" y="${Y - 8}" font-size="14" style="--dl:${900 + j * 200}ms">${esc(q[2])}</text>`;
  });
  return { html: `<svg class="b-svg el" viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="y = ${esc(fns.join(", "))}"><defs><clipPath id="${cid}"><rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}"/></clipPath></defs>${g}<g clip-path="url(#${cid})">${curves}</g>${pts}${legend}</svg>`, dur: 900 + fns.length * 500 };
}
function figSVG(el) {
  const w = clamp(num(el.w, 100), 10, 2000), h = clamp(num(el.h, 60), 10, 2000);
  const sw = Math.max(w, h) / 160, fs = Math.max(w, h) / 20;
  const shapes = (Array.isArray(el.s) ? el.s : Array.isArray(el.shapes) ? el.shapes : []).slice(0, 60);
  let out = "", tm = 0;
  for (const raw of shapes) {
    let s = raw;
    if (Array.isArray(raw)) s = { t: raw[0], p: raw.slice(1).filter(v => typeof v === "number"), v: raw.find((v, k) => k > 0 && typeof v === "string") };
    if (!s || typeof s !== "object") continue;
    const p = (Array.isArray(s.p) ? s.p : []).map(Number);
    const c = colKey(s.c), dash = s.d ? ` stroke-dasharray="${sw * 3} ${sw * 2.5}"` : "";
    const cls = s.d ? `fadein sv-${c}` : `draw sv-${c}`;
    const fill = s.f ? `fill="currentColor" fill-opacity=".14" class="${cls} c-${c}"` : `fill="none" class="${cls}"`;
    const st = `stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${s.d ? "" : ' pathLength="1"'} style="--dl:${tm}ms;--d:500ms"${dash}`;
    const type = String(s.t || s.type || "").toLowerCase();
    if ((type === "line" || type === "arrow" || type === "darrow") && p.length >= 4) {
      out += `<line x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}" ${fill} ${st}/>`;
      const head = (ax, ay, bx, by) => { const a = Math.atan2(by - ay, bx - ax), L = sw * 5; return `<polyline points="${bx - L * Math.cos(a - .45)},${by - L * Math.sin(a - .45)} ${bx},${by} ${bx - L * Math.cos(a + .45)},${by - L * Math.sin(a + .45)}" fill="none" class="fadein sv-${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="--dl:${tm + 400}ms"/>`; };
      if (type !== "line") out += head(p[0], p[1], p[2], p[3]);
      if (type === "darrow") out += head(p[2], p[3], p[0], p[1]);
    } else if (type === "circle" && p.length >= 3) out += `<circle cx="${p[0]}" cy="${p[1]}" r="${Math.abs(p[2])}" ${fill} ${st}/>`;
    else if (type === "ellipse" && p.length >= 4) out += `<ellipse cx="${p[0]}" cy="${p[1]}" rx="${Math.abs(p[2])}" ry="${Math.abs(p[3])}" ${fill} ${st}/>`;
    else if (type === "rect" && p.length >= 4) out += `<rect x="${p[0]}" y="${p[1]}" width="${Math.abs(p[2])}" height="${Math.abs(p[3])}" rx="${sw}" ${fill} ${st}/>`;
    else if ((type === "poly" || type === "polygon" || type === "pl" || type === "polyline") && p.length >= 4) {
      const pts = []; for (let k = 0; k + 1 < p.length; k += 2) pts.push(p[k] + "," + p[k + 1]);
      out += `<${type === "pl" || type === "polyline" ? "polyline" : "polygon"} points="${pts.join(" ")}" ${fill} ${st}/>`;
    } else if (type === "arc" && p.length >= 5) {
      const [cx, cy, r, a1, a2] = p, rad = a => a * Math.PI / 180;
      const xA = cx + r * Math.cos(rad(a1)), yA = cy - r * Math.sin(rad(a1)), xB = cx + r * Math.cos(rad(a2)), yB = cy - r * Math.sin(rad(a2));
      const large = Math.abs(a2 - a1) % 360 > 180 ? 1 : 0, sweep = a2 > a1 ? 0 : 1;
      out += `<path d="M${xA} ${yA} A${r} ${r} 0 ${large} ${sweep} ${xB} ${yB}" ${fill} ${st}/>`;
    } else if (type === "dot" && p.length >= 2) out += `<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 2.2}" class="fadein tf-${c}" style="--dl:${tm}ms"/>`;
    else if ((type === "text" || type === "label") && p.length >= 2) {
      const size = s.s ? clamp(num(s.s, fs), fs * .5, fs * 2) : fs;
      out += `<text x="${p[0]}" y="${p[1]}" font-size="${size}" text-anchor="${s.a === "l" ? "start" : s.a === "r" ? "end" : "middle"}" dominant-baseline="middle" class="fadein tf-${c}" style="--dl:${tm}ms">${esc(s.v ?? s.text ?? "")}</text>`;
    } else continue;
    tm += 260;
  }
  return { html: `<svg class="b-svg el" viewBox="${-w * .04} ${-h * .06} ${w * 1.08} ${h * 1.12}" role="img">${out}</svg>`, dur: tm + 400 };
}

/* ================= board elements ================= */
const textDur = s => clamp(String(s || "").length * 32, 450, 2200);
function renderEl(e) {
  if (typeof e === "string") e = { k: "w", t: e };
  if (!e || typeof e !== "object") return null;
  const k = String(e.k || e.type || (e.t ? "w" : "")).toLowerCase();
  const c = "c-" + colKey(e.c);
  const tx = e.t ?? e.text ?? "";
  const wrap = (cls, inner, dur) => ({ html: `<div class="el ${cls} ${c} wr" style="--d:${dur}ms">${inner}</div>`, dur });
  switch (k) {
    case "h": return wrap("b-h", rich(tx), textDur(tx));
    case "w": case "text": return wrap("b-w", rich(tx), textDur(tx));
    case "m": case "math": return wrap("b-m", String(tx).includes("$") || (!looksTex(tx) && /[ก-๙]/.test(tx)) ? rich(tx) : `<span class="mx">${tex(tx)}</span>`, textDur(tx));
    case "n": case "note": return wrap("b-n", rich(tx), textDur(tx));
    case "box": return wrap("b-box", String(tx).includes("$") || !looksTex(tx) ? rich(tx) : `<span class="mx">${tex(tx)}</span>`, textDur(tx));
    case "list": { const items = (Array.isArray(e.items) ? e.items : []).slice(0, 10); return wrap("b-list-wrap", `<ul class="b-list">${items.map(x => `<li>${rich(x)}</li>`).join("")}</ul>`, clamp(items.join("").length * 25, 500, 3000)); }
    case "table": { const rows = (Array.isArray(e.rows) ? e.rows : []).slice(0, 14).filter(Array.isArray); if (!rows.length) return null; const [hd, ...rest] = rows; return wrap("b-tab", `<table><thead><tr>${hd.map(x => `<th>${rich(x)}</th>`).join("")}</tr></thead><tbody>${rest.map(r => `<tr>${r.map(x => `<td>${rich(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`, clamp(rows.flat().join("").length * 18, 600, 3000)); }
    case "plot": case "graph": { const r = plotSVG(e); return { html: `<div class="${c}">${r.html}</div>`, dur: r.dur }; }
    case "fig": case "diagram": { const r = figSVG(e); return { html: `<div class="${c}">${r.html}</div>`, dur: r.dur }; }
    case "div": case "hr": return { html: `<hr class="b-div">`, dur: 200 };
    default: return tx ? wrap("b-w", rich(tx), textDur(tx)) : null;
  }
}

/* ================= state ================= */
const boardEl = $("#board"), inner = $("#boardInner"), content = $("#boardContent"), feed = $("#feed"), input = $("#input");
const V = { provider: "pending", health: null, sample: null, tts: null, ttsOk: true, ttsLangs: null, dict: null, sr: null, srOn: false, imgLimits: null };
let L = null;
const P = { cursor: 0, playing: false, running: false, restart: false };
let gen = 0; const waiters = new Set();
function sleep(ms) { return new Promise(res => { const w = () => { clearTimeout(tm); waiters.delete(w); res(false); }; const tm = setTimeout(() => { waiters.delete(w); res(true); }, ms); waiters.add(w); }); }
function waitForMore() { return new Promise(res => { const w = () => { waiters.delete(w); res(); }; waiters.add(w); }); }
function wake() { for (const w of [...waiters]) w(); }
function interrupt() { gen++; wake(); Voice.stop(); finishAnims(); }
function finishAnims() { $$(".step:not(.done)", content).forEach(s => s.classList.add("done")); }

/* ================= voice (Thai + English) ================= */
const speechLang = s => /[฀-๿]/.test(s) ? "th" : (S.lang === "th" && !/[a-z]{3}/i.test(s) ? "th" : "en");
function chunkText(s, max = 180) {
  const out = []; let rest = s.trim();
  while (rest.length > max) {
    let cut = -1;
    for (const re of [/[.!?。]\s/g, /[,;:]\s/g, /\s/g]) { let m; re.lastIndex = 0; while ((m = re.exec(rest)) && m.index < max) cut = m.index + 1; if (cut > max * .4) break; }
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
const Voice = {
  token: 0, voices: [], warned: false,
  kind() { if (V.tts && V.ttsOk) return "claude"; if (!V.tts && "speechSynthesis" in window && V.provider !== "claude") return "browser"; return "none"; },
  available() { return this.kind() !== "none"; },
  loadVoices() { try { this.voices = speechSynthesis.getVoices().filter(v => /^(th|en)/i.test(v.lang)); } catch { this.voices = []; } },
  hasLang(lang) { return this.voices.some(v => v.lang.toLowerCase().startsWith(lang)); },
  pick(lang) {
    const want = lang === "th" ? S.voiceTh : S.voiceEn;
    const list = this.voices.filter(v => v.lang.toLowerCase().startsWith(lang));
    if (want) { const v = list.find(x => x.name === want); if (v) return v; }
    const score = v => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (lang === "en" && /en[-_](us|gb)/i.test(v.lang) ? 1 : 0);
    return list.sort((a, b) => score(b) - score(a))[0] || null;
  },
  stop() {
    this.token++;
    if (V.tts && V.tts.active && V.tts.active()) V.tts.stop().catch(() => {});
    if ("speechSynthesis" in window && !V.tts) { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
    setSpeaking(false);
  },
  async speak(text) {
    const s = speechText(text); if (!s) return;
    const lang = speechLang(s), my = ++this.token;
    if (this.kind() === "claude") {
      const opts = { voice: S.claudeVoice, rate: S.rate };
      if (V.ttsLangs && V.ttsLangs.includes(lang)) opts.language = lang;
      try { setSpeaking(true); await V.tts.speak(s.slice(0, 1990), opts); }
      catch (e) { const code = e && e.code; if (code === "not_granted" || code === "unavailable") { V.ttsOk = false; renderVoice(); } if (code !== "stopped") throw e; }
      finally { if (my === this.token) setSpeaking(false); }
      return;
    }
    if (this.kind() !== "browser") throw new Error("no voice");
    if (!this.voices.length) this.loadVoices();
    if (lang === "th" && this.voices.length && !this.hasLang("th")) { if (!this.warned) { this.warned = true; addNote(t("noThaiVoice")); } throw new Error("no thai voice"); }
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    const voice = this.pick(lang);
    setSpeaking(true);
    try {
      for (const part of chunkText(s)) {
        if (my !== this.token) return;
        await new Promise(res => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = voice ? voice.lang : (lang === "th" ? "th-TH" : "en-US"); if (voice) u.voice = voice; u.rate = S.rate || 1;
          const guard = setTimeout(res, part.length * 160 / (S.rate || 1) + 4000);
          const done = () => { clearTimeout(guard); clearInterval(poll); res(); };
          const poll = setInterval(() => { if (my !== this.token) done(); }, 120);
          u.onend = done; u.onerror = done;
          speechSynthesis.speak(u);
        });
      }
    } finally { if (my === this.token) setSpeaking(false); }
  }
};
if ("speechSynthesis" in window) { Voice.loadVoices(); speechSynthesis.addEventListener?.("voiceschanged", () => Voice.loadVoices()); }
async function speakOrWait(text, my) {
  const s = speechText(text);
  if (!s) return sleep(500);
  const readMs = clamp(s.length * 70 / (S.rate || 1), 1600, 12000);
  if (S.voiceOn && Voice.available()) {
    try { await Voice.speak(text); return; } catch { if (my !== gen) return; }
  }
  return sleep(readMs);
}
async function speakSeq(list) {
  const my = gen;
  for (const x of list) { if (my !== gen) return; try { await Voice.speak(x); } catch { return; } }
}
function setSpeaking(on) { $("#caption").classList.toggle("speaking", !!on); }
const ICON_VOICE = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>', ICON_MUTE = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>';
function renderVoice() {
  const can = Voice.available() || V.provider === "pending", on = S.voiceOn && can;
  $("#voiceIcon").innerHTML = on ? ICON_VOICE : ICON_MUTE; $("#voiceBtn").setAttribute("aria-pressed", String(on));
  $("#voiceBtn").disabled = !can; const lbl = can ? (on ? t("voiceOn") : t("voiceOff")) : t("voiceNA");
  $("#voiceBtn").title = lbl; $("#voiceBtn").setAttribute("aria-label", lbl);
}

/* ================= playback ================= */
const stepDom = idx => content.querySelector(`.step[data-i="${idx}"]`);
async function drawStep(idx, animate) {
  if (stepDom(idx)) return;
  const st = L.steps[idx]; const div = document.createElement("div");
  div.className = "step" + (animate ? "" : " done"); div.dataset.i = idx;
  let dl = 0, html = "";
  for (const e of st.board) { const r = renderEl(e); if (!r) continue; html += r.html.replace(/^<(\w+) /, `<$1 data-dl="${Math.round(dl)}" `); dl += r.dur * .9; }
  div.innerHTML = html;
  div.querySelectorAll("[data-dl]").forEach(n => { const base = +n.dataset.dl; n.style.setProperty("--dl", base + "ms"); n.querySelectorAll("[style*='--dl']").forEach(ch => { const v = parseFloat(ch.style.getPropertyValue("--dl")) || 0; ch.style.setProperty("--dl", (base + v) + "ms"); }); });
  content.appendChild(div);
  scrollBoard();
  if (animate && dl > 0 && !reduceMotion()) await sleep(dl + 150);
  div.classList.add("done");
}
let stickBottom = true;
boardEl.addEventListener("scroll", () => { stickBottom = boardEl.scrollTop + boardEl.clientHeight > boardEl.scrollHeight - 80; }, { passive: true });
function scrollBoard() { if (stickBottom) requestAnimationFrame(() => boardEl.scrollTo({ top: boardEl.scrollHeight, behavior: reduceMotion() ? "auto" : "smooth" })); }
function kick() { if (P.running) { P.restart = true; return; } playLoop(); }
async function playLoop() {
  P.running = true; const my = gen;
  try {
    while (P.playing && my === gen && L) {
      if (P.cursor >= L.steps.length) { if (L.streaming) { await waitForMore(); if (my !== gen) break; continue; } break; }
      const idx = P.cursor, st = L.steps[idx];
      setCaption(st.say, idx);
      await Promise.all([drawStep(idx, true), speakOrWait(st.say, my)]);
      if (my !== gen) break;
      P.cursor = idx + 1; updateProgress();
    }
  } finally {
    P.running = false;
    if (P.restart) { P.restart = false; playLoop(); }
    else if (my === gen && L && P.cursor >= L.steps.length && !L.streaming && P.playing) { P.playing = false; renderPlay(); segmentEnd(); }
  }
}
function play() { if (!L || !L.steps.length) return; if (P.cursor >= L.steps.length && !L.streaming) { replay(); return; } P.playing = true; renderPlay(); kick(); }
function pause() { P.playing = false; interrupt(); renderPlay(); }
function skip() {
  if (!L) return; const idx = P.cursor; interrupt();
  if (idx < L.steps.length) { drawStep(idx, false); P.cursor = idx + 1; }
  updateProgress();
  if (P.cursor < L.steps.length) setCaption(L.steps[P.cursor].say, P.cursor);
  if (P.playing) kick(); else if (P.cursor >= L.steps.length && !L.streaming) segmentEnd();
}
function replay() { if (!L || !L.steps.length) return; interrupt(); content.innerHTML = ""; P.cursor = 0; P.playing = true; stickBottom = true; renderPlay(); updateProgress(); kick(); }
function showAll() {
  if (!L) return; interrupt();
  for (let k = 0; k < L.steps.length; k++) drawStep(k, false);
  P.cursor = L.steps.length; P.playing = false; renderPlay(); updateProgress();
  const last = L.steps[L.steps.length - 1]; if (last) setCaption(last.say, L.steps.length - 1);
  if (!L.streaming) segmentEnd();
}
function setCaption(say, idx) { $("#sayText").innerHTML = rich(say || ""); if (L) $("#stepNo").textContent = L.steps.length ? t("stepOf", { i: idx + 1, n: L.steps.length + (L.streaming ? "+" : "") }) : ""; }
function updateProgress() { if (!L) return; const n = L.steps.length; const cur = Math.max(1, Math.min(P.cursor + (P.playing && P.cursor < n ? 1 : 0), n)); $("#stepNo").textContent = n ? t("stepOf", { i: cur, n: n + (L.streaming ? "+" : "") }) : ""; }
const ICON_PLAY = '<path d="M7 4v16l13-8z"/>', ICON_PAUSE = '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>';
function renderPlay() { $("#playIcon").innerHTML = P.playing ? ICON_PAUSE : ICON_PLAY; const l = P.playing ? t("pause") : t("play"); $("#playBtn").setAttribute("aria-label", l); $("#playBtn").title = l; }

/* ================= talking to the tutor ================= */
function authHeaders() { return S.pw ? { authorization: "Bearer " + S.pw } : {}; }
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...authHeaders() } });
  if (r.status === 401) throw { code: "auth" };
  return r;
}
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_TYPE = { txt: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv", pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const fileType = f => (IMG_TYPES.includes(f.type) || ["application/pdf", "text/plain", "text/markdown", "text/csv"].includes(f.type)) ? f.type : EXT_TYPE[(f.name.split(".").pop() || "").toLowerCase()] || "";
const fileKind = f => { const ty = fileType(f); return ty.startsWith("image/") ? "image" : ty === "application/pdf" ? "pdf" : ty ? "text" : ""; };
async function shrinkImage(f) {
  if (f.type === "image/gif") return f;
  try {
    const bmp = await createImageBitmap(f);
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (sc === 1 && f.size < 1.5e6) return f;
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, "image/jpeg", .86));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch { return f; }
}
async function readSSE(res, handlers) {
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", done = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true }).replace(/\r/g, "");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = "message", data = "";
      for (const line of block.split("\n")) { if (line.startsWith("event:")) ev = line.slice(6).trim(); else if (line.startsWith("data:")) data += line.slice(5).replace(/^ /, ""); }
      if (!data) continue;
      const d = JSON.parse(data);
      if (ev === "start") handlers.start(d); else if (ev === "delta") handlers.delta(d);
      else if (ev === "done") done = d; else if (ev === "error") throw { code: d.code, message: d.message };
    }
  }
  return done;
}
async function callServer({ text, display, files, signal, onDelta }) {
  let fileIds = [];
  if (files.length) {
    setStatus(t("uploading"));
    const fd = new FormData();
    for (const f of files) { const g = fileKind(f) === "image" ? await shrinkImage(f) : f; fd.append("files", g, g.name); }
    const r = await api("api/upload", { method: "POST", body: fd, signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: j.error === "image_too_large" ? "image_too_large" : j.error === "too_large" ? "too_large" : "upload" };
    fileIds = j.files.map(x => x.id);
    files.forEach((f, k) => { if (j.files[k]) f.serverId = j.files[k].id; });
    setStatus(t("thinking"));
  }
  const res = await api("api/chat", { method: "POST", signal, headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonId: L.serverId, mode: L.mode, subject: L.subject, level: L.level, lang: S.lang, quizN: L.quizN, tier: S.tier, text, display, fileIds }) });
  if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); throw { code: j.error === "empty" ? "bad_request" : "generic" }; }
  const lesson = L;
  const done = await readSSE(res, { start: d => { lesson.serverId = d.lessonId; }, delta: onDelta });
  if (!done) throw { code: signal.aborted ? "cancelled" : "network" };
  if (done.title && !lesson.title) { lesson.title = done.title; if (lesson === L) setTitle(lesson.title); }
  return { truncated: done.truncated };
}
async function callArtifact({ text, display, files, signal, onDelta }) {
  const images = [], extra = [];
  for (const f of files) {
    const k = fileKind(f);
    if (k === "image") images.push(f);
    else if (k === "text") extra.push(`\n\n[${f.name}]\n` + (await f.text()).slice(0, 100000));
    else if (k === "pdf") addNote(t("noPdfHere"), true);
  }
  if (images.length && !V.imgLimits) { addNote(t("noImages"), true); images.length = 0; }
  let msg = text + extra.join("");
  if (L.lang !== S.lang && L.turns.length) msg = `(${S.lang === "en" ? "From now on, reply only in English." : "ต่อจากนี้ตอบเป็นภาษาไทยเท่านั้น"})\n` + msg;
  L.lang = S.lang;
  if (images.length) msg += `\n[${images.length} image(s) attached]`;
  if (!L.turns.length) L.turns.push({ role: "user", content: rulesFor(L) + "\n\n---\nStudent's request:\n" + msg, display: display || text });
  else L.turns.push({ role: "user", content: msg, display: display || text });
  const turns = L.turns.length > 16 ? [L.turns[0], { role: "assistant", content: "(earlier conversation omitted)" }, ...L.turns.slice(-14)] : L.turns.slice();
  const merged = [];
  for (const x of turns) { const last = merged[merged.length - 1]; if (last && last.role === x.role) last.content += "\n\n" + x.content; else merged.push({ role: x.role, content: x.content }); }
  const opts = { onText: ({ delta }) => onDelta(delta), signal, cache: false, modelTier: S.tier || "default" };
  if (images.length) opts.images = images;
  try {
    const r = await V.sample(merged, opts);
    L.turns.push({ role: "assistant", content: r.text });
    return { truncated: r.truncated };
  } catch (e) {
    if (e && e.text) L.turns.push({ role: "assistant", content: e.text }); else L.turns.pop();
    throw e;
  }
}

/* ================= lessons ================= */
function newLesson() {
  interrupt();
  L = { id: "L" + Date.now().toString(36), serverId: null, mode: S.mode, subject: S.subject, level: S.level, lang: S.lang, quizN: +S.quizN || 8, title: "", steps: [], turns: [], pending: [], msgs: [], segSteps: 0, streaming: false, created: Date.now(), sample: false, active: true };
  P.cursor = 0; P.playing = false; content.innerHTML = ""; stickBottom = true; ink.clear();
  setTitle(""); $("#sayText").textContent = ""; $("#stepNo").textContent = ""; renderPlay();
}
function setTitle(s) { $("#boardTitle").textContent = s ? t("topicPrefix") + s : ""; $("#panelTitle").textContent = s || t("panelTitle"); }
function handleObj(o, live) {
  const ty = kindOf(o);
  if (ty === "meta") { if (o.title && !L.title) { L.title = String(o.title).slice(0, 80); setTitle(L.title); } }
  else if (ty === "step") { L.steps.push({ say: String(o.say ?? o.s ?? ""), board: (Array.isArray(o.board) ? o.board : Array.isArray(o.b) ? o.b : []).slice(0, 8) }); L.segSteps++; wake(); updateProgress(); }
  else if (ty === "msg") { const s = String(o.t ?? o.text ?? ""); addTutorMsg(s); if (live) L.msgs.push(s); }
  else if (ty === "check") L.pending.push({ type: "check", q: String(o.q ?? ""), choices: Array.isArray(o.choices) ? o.choices.slice(0, 5).map(String) : [] });
  else if (ty === "quiz") {
    const qs = (Array.isArray(o.qs) ? o.qs : []).filter(q => q && Array.isArray(q.c) && q.c.length >= 2)
      .map(q => ({ q: String(q.q ?? ""), c: q.c.map(String), a: clamp(Math.round(num(q.a, 0)), 0, q.c.length - 1), why: String(q.why ?? "") }));
    if (qs.length) L.pending.push({ type: "quiz", qs });
  }
}
let busy = false, ctl = null;
async function ask(text, { files = [], display = null } = {}) {
  if (busy) return;
  text = String(text || "").trim();
  if (!text && !files.length) return;
  if (V.provider === "pending") await providerReady;
  if (V.provider === "none") { addNote(t("offline"), true); return; }
  if (V.provider === "nokey") { addNote(t("nokey"), true); return; }
  if (!L || !L.active) newLesson();
  if (!text) text = t("file." + L.mode);
  addUserMsg(display || text, files.map(f => ({ name: f.name, kind: fileKind(f), local: f })));
  busy = true; setBusy(true); clearQuick();
  ctl = new AbortController();
  L.streaming = true; L.segSteps = 0; L.msgs = []; P.playing = true; renderPlay(); kick();
  const lesson = L; let got = 0;
  const feeder = lineFeeder(o => { if (lesson !== L) return; got++; handleObj(o, true); });
  try {
    const call = V.provider === "claude" ? callArtifact : callServer;
    const r = await call({ text, display, files, signal: ctl.signal, onDelta: d => feeder.push(d) });
    feeder.end();
    if (lesson === L) {
      if (!got) addNote(t("err.empty_completion"), true);
      if (r.truncated) addNote(t("truncated"));
      if (!L.title) { L.title = (display || text).slice(0, 40); setTitle(L.title); }
      if (V.provider === "claude") saveLocal();
    }
  } catch (e) {
    feeder.end();
    if (lesson === L) {
      const code = e && e.code;
      if (code === "cancelled" || (e && e.name === "AbortError")) addNote(t("stopped"));
      else { addNote(t("err." + code) !== "err." + code ? t("err." + code) : t("err.generic") + (e && e.message ? ` (${String(e.message).slice(0, 140)})` : ""), true); if (code === "auth") openSettings(); }
      if (!got && !L.serverId && !L.turns.length) L.active = false;
    }
  } finally {
    busy = false; setBusy(false); ctl = null;
    if (lesson === L) {
      L.streaming = false; wake(); updateProgress();
      if (P.cursor >= L.steps.length) { P.playing = false; renderPlay(); }
      if (!P.playing) segmentEnd();
    }
  }
}
function segmentEnd() {
  if (!L) return;
  const items = L.pending.splice(0);
  for (const it of items) { if (it.type === "check") addCheck(it); else if (it.type === "quiz") addQuiz(it); }
  const say = (L.msgs || []).splice(0);
  if (say.length && S.voiceOn && Voice.available() && (L.mode === "chat" || L.segSteps === 0)) speakSeq(say);
  renderQuick();
}

/* ================= feed ================= */
function addFeed(node) { feed.appendChild(node); requestAnimationFrame(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" })); return node; }
function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
const ICON_SPEAK = '<svg class="i" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>';
function readBtn(textToRead) {
  const b = el("button", "rd", ICON_SPEAK); b.type = "button"; b.title = t("readAloud"); b.setAttribute("aria-label", t("readAloud"));
  b.onclick = () => { if (P.playing) pause(); else Voice.stop(); Voice.speak(textToRead).catch(() => {}); };
  b.hidden = !Voice.available();
  return b;
}
async function authedObjectUrl(id) { try { const r = await api("api/files/" + encodeURIComponent(id)); return r.ok ? URL.createObjectURL(await r.blob()) : ""; } catch { return ""; } }
function addUserMsg(text, files) {
  const n = el("div", "msg me"); n.textContent = text;
  const imgs = files.filter(f => f.kind === "image"), docs = files.filter(f => f.kind !== "image");
  if (imgs.length) {
    const th = el("div", "thumbs");
    imgs.forEach(f => { const im = document.createElement("img"); im.alt = f.name; if (f.local) im.src = URL.createObjectURL(f.local); else if (f.id) authedObjectUrl(f.id).then(u => { if (u) im.src = u; }); th.appendChild(im); });
    n.appendChild(th);
  }
  if (docs.length) {
    const fl = el("div", "files");
    docs.forEach(f => { const c = el("span", "fchip", `<b>${esc((f.name.split(".").pop() || "").toUpperCase())}</b><span>${esc(f.name)}</span>`); fl.appendChild(c); });
    n.appendChild(fl);
  }
  addFeed(n);
}
function addTutorMsg(s) { if (!String(s).trim()) return; const n = el("div", "msg tutor", rich(s)); n.appendChild(readBtn(s)); addFeed(n); }
function addNote(s, err) { addFeed(el("div", "note" + (err ? " err" : ""), esc(s))); }
const LETTERS = () => S.ui === "th" ? "กขคงจฉ" : "ABCDEF";
function addCheck(it) {
  const c = el("div", "card");
  c.innerHTML = `<span class="label">${esc(t("checkLabel"))}</span>`;
  const row = el("div", "q-row"); row.appendChild(el("div", "q", rich(it.q))); row.appendChild(readBtn(it.q)); c.appendChild(row);
  if (it.choices.length) {
    const ch = el("div", "choices");
    it.choices.forEach((x, k) => { const b = el("button", "choice", `<span class="k">${LETTERS()[k]}</span><span>${rich(x)}</span>`); b.type = "button"; b.onclick = () => { if (busy) return; $$(".choice", ch).forEach(z => z.disabled = true); b.classList.add("right"); ask(t("myAnswer") + x); }; ch.appendChild(b); });
    c.appendChild(ch); c.appendChild(el("p", "note", esc(t("orType"))));
  } else c.appendChild(el("p", "note", esc(t("typeOrInk"))));
  addFeed(c);
  input.focus({ preventScroll: true });
}
function addQuiz(it) {
  const c = el("div", "card"); const st = { i: 0, picks: [] };
  const render = () => {
    if (st.i >= it.qs.length) {
      const right = st.picks.filter((p, k) => p === it.qs[k].a).length;
      c.innerHTML = `<span class="label">${esc(t("quizResult"))}</span><div class="score">${right} / ${it.qs.length}</div><p>${esc(right === it.qs.length ? t("allRight") : right >= it.qs.length * .7 ? t("nearly") : t("keepGoing"))}</p>`;
      const rb = el("div", "row-btns");
      const missed = it.qs.map((q, k) => ({ q, p: st.picks[k] })).filter(x => x.p !== x.q.a);
      if (missed.length) { const b = el("button", "btn primary", esc(t("teachMissed"))); b.type = "button"; b.onclick = () => ask(t("missedMsg") + "\n" + missed.map(x => t("missedLine", { q: x.q.q, mine: x.q.c[x.p], right: x.q.c[x.q.a] })).join("\n"), { display: t("teachMissedN", { n: missed.length }) }); rb.appendChild(b); }
      const nb = el("button", "btn", esc(t("newQuiz"))); nb.type = "button"; nb.onclick = () => ask(t("newQuizMsg", { n: L ? L.quizN : 8 }), { display: t("newQuiz") }); rb.appendChild(nb);
      c.appendChild(rb); return;
    }
    const q = it.qs[st.i];
    c.innerHTML = `<div class="qmeta"><span class="label">${esc(t("quizLabel"))}</span><span>${esc(t("quizOf", { i: st.i + 1, n: it.qs.length }))}</span></div><div class="q">${rich(q.q)}</div>`;
    const ch = el("div", "choices");
    q.c.forEach((x, k) => {
      const b = el("button", "choice", `<span class="k">${LETTERS()[k] || k + 1}</span><span>${rich(x)}</span>`); b.type = "button";
      b.onclick = () => {
        st.picks[st.i] = k; $$(".choice", ch).forEach((z, j) => { z.disabled = true; if (j === q.a) z.classList.add("right"); else if (j === k) z.classList.add("wrong"); });
        c.appendChild(el("div", "why", `<b>${esc(k === q.a ? t("correct") : t("wrong"))}</b> ${rich(q.why)}`));
        const nb = el("button", "btn primary", esc(st.i + 1 < it.qs.length ? t("nextQ") : t("seeScore"))); nb.type = "button"; nb.onclick = () => { st.i++; render(); }; c.appendChild(nb); nb.focus({ preventScroll: true });
        feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
      };
      ch.appendChild(b);
    });
    c.appendChild(ch);
  };
  render(); addFeed(c);
}
function clearQuick() { $("#quick").innerHTML = ""; }
function renderQuick() {
  const q = $("#quick"); q.innerHTML = "";
  if (!L || !L.active || (!L.serverId && !L.turns.length)) return;
  for (const [label, msg] of t("q." + L.mode)) { const b = el("button", "chip", esc(label)); b.type = "button"; b.onclick = () => ask(msg, { display: label }); q.appendChild(b); }
}
function setStatus(s) { $("#statusText").textContent = s; }
function setBusy(on) { $("#status").hidden = !on; $("#sendBtn").disabled = on; setStatus(t("thinking")); }

/* ================= welcome / sample ================= */
function welcome() {
  let c = $("#welcome");
  if (!c) { c = el("div", "card welcome"); c.id = "welcome"; feed.prepend(c); }
  c.innerHTML = `<h3>${esc(t("welcomeTitle"))}</h3><ul>${["topic", "homework", "exam", "chat"].map(m => `<li>${t("w." + m)}</li>`).join("")}</ul><p class="note" style="text-align:left">${esc(t("welcomeHint"))}</p>`;
  const ch = el("div", "chips");
  for (const x of t("ex." + S.mode)) { const b = el("button", "chip", esc(x)); b.type = "button"; b.onclick = () => { input.value = x; autoGrow(); input.focus(); }; ch.appendChild(b); }
  c.appendChild(ch);
}
function loadSample() {
  const smp = t("sample");
  L = { id: "sample", mode: "topic", subject: "math", level: "lower", lang: S.lang, title: smp.title, steps: smp.steps.map(s => ({ ...s })), turns: [], pending: [], msgs: [], streaming: false, sample: true, active: false };
  setTitle(smp.title); $("#panelTitle").textContent = t("panelTitle");
  stickBottom = false; content.innerHTML = ""; for (let k = 0; k < L.steps.length; k++) drawStep(k, false);
  P.cursor = L.steps.length; P.playing = false; renderPlay();
  $("#sayText").textContent = t("sampleCaption"); $("#stepNo").textContent = t("nSteps", { n: L.steps.length });
  boardEl.scrollTop = 0;
}

/* ================= history ================= */
function saveLocal() {
  if (!L || L.sample) return;
  const all = store.get("kb2-lessons", []).filter(x => x.id !== L.id);
  all.unshift({ id: L.id, mode: L.mode, subject: L.subject, level: L.level, lang: L.lang, quizN: L.quizN, title: L.title, created: L.created, updated: Date.now(), steps: L.steps.length, turns: L.turns.slice(-24) });
  while (all.length > 30) all.pop();
  for (let n = 0; n < 5 && !store.set("kb2-lessons", all) && all.length > 1; n++) all.splice(Math.ceil(all.length / 2));
}
async function listLessons() {
  if (V.provider === "server") { const r = await api("api/lessons"); return (await r.json()).lessons; }
  return store.get("kb2-lessons", []);
}
async function deleteLessonById(id) {
  if (V.provider === "server") await api("api/lessons/" + encodeURIComponent(id), { method: "DELETE" });
  else store.set("kb2-lessons", store.get("kb2-lessons", []).filter(y => y.id !== id));
}
async function openHistory() {
  const list = $("#histList"); list.innerHTML = "";
  let all = [];
  try { all = await listLessons(); } catch (e) { addNote(t("err." + (e && e.code || "generic")), true); }
  $("#histEmpty").hidden = all.length > 0;
  const fmt = new Intl.DateTimeFormat(S.ui === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  all.forEach(x => {
    const li = el("li", "", `<span class="badge">${esc(t("modeName." + x.mode))}</span><span class="t"><b>${esc(x.title || t("untitled"))}</b><span>${esc(fmt.format(x.updated || x.created || Date.now()))} · ${esc(t("nSteps", { n: typeof x.steps === "number" ? x.steps : 0 }))}</span></span>`);
    const o = el("button", "btn", esc(t("open"))); o.type = "button"; o.onclick = () => { $("#histDlg").close(); openLesson(x.id); };
    const d = el("button", "icon-btn", '<svg class="i" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'); d.type = "button"; d.setAttribute("aria-label", t("del")); d.title = t("del");
    d.onclick = async () => { if (!d.dataset.arm) { d.dataset.arm = "1"; d.title = t("delConfirm"); d.style.color = "var(--bad)"; return; } await deleteLessonById(x.id).catch(() => {}); li.remove(); $("#histEmpty").hidden = list.children.length > 0; };
    li.append(o, d); list.appendChild(li);
  });
  $("#histDlg").showModal();
}
async function openLesson(id) {
  let src, files = {};
  try {
    if (V.provider === "server") { const r = await api("api/lessons/" + encodeURIComponent(id)); if (!r.ok) throw { code: "generic" }; const j = await r.json(); src = j.lesson; files = j.files || {}; }
    else src = store.get("kb2-lessons", []).find(x => x.id === id);
  } catch (e) { addNote(t("err." + (e && e.code || "generic")), true); return; }
  if (!src) return;
  interrupt();
  L = { id: src.id, serverId: V.provider === "server" ? src.id : null, mode: src.mode, subject: src.subject, level: src.level, lang: src.lang || S.lang, quizN: src.quizN || 8, title: src.title || "", steps: [], turns: V.provider === "server" ? [] : (src.turns || []), pending: [], msgs: [], segSteps: 0, streaming: false, created: src.created, sample: false, active: true };
  setMode(L.mode, true); setTitle(L.title); feed.innerHTML = "";
  content.innerHTML = ""; ink.clear();
  const turns = src.turns || [];
  turns.forEach((tn, k) => {
    if (tn.role === "user") addUserMsg(tn.display || (k === 0 && V.provider !== "server" ? (tn.content.split("Student's request:\n")[1] || tn.content) : tn.content), (tn.files || []).map(fid => typeof fid === "string" ? { id: fid, name: files[fid]?.name || "file", kind: files[fid]?.kind || "text" } : fid));
    else { L.pending = []; parseReply(tn.content).forEach(o => handleObj(o, false)); }
  });
  for (let k = 0; k < L.steps.length; k++) drawStep(k, false);
  P.cursor = L.steps.length; P.playing = false; renderPlay(); updateProgress();
  const last = L.steps[L.steps.length - 1]; $("#sayText").innerHTML = last ? rich(last.say) : "";
  addNote(t("opened", { t: L.title })); segmentEnd();
}

/* ================= ink: the student writes on the board ================= */
const ink = (() => {
  const cv = $("#ink"), g = cv.getContext("2d"); let strokes = [], cur = null, on = false, color = "k", eraser = false;
  const colorOf = k => getComputedStyle(document.documentElement).getPropertyValue({ k: "--ink", b: "--ink-b", r: "--ink-r", g: "--ink-g" }[k]).trim() || "#222";
  function size() {
    cv.style.width = "0px"; cv.style.height = "0px";
    const w = inner.scrollWidth, h = inner.scrollHeight, dpr = devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); redraw(); }
    cv.style.width = w + "px"; cv.style.height = h + "px";
  }
  function drawStroke(s, ctx = g, dpr = devicePixelRatio || 1, ox = 0, oy = 0, force) {
    if (!s.pts.length) return; ctx.save(); ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.erase && !force ? "destination-out" : "source-over"; ctx.strokeStyle = force || colorOf(s.c); ctx.lineWidth = s.erase ? 22 : 3;
    ctx.beginPath(); ctx.moveTo(s.pts[0][0] - ox, s.pts[0][1] - oy); for (const [x, y] of s.pts.slice(1)) ctx.lineTo(x - ox, y - oy); if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] - ox + .1, s.pts[0][1] - oy); ctx.stroke(); ctx.restore();
  }
  function redraw() { g.clearRect(0, 0, cv.width, cv.height); strokes.forEach(s => drawStroke(s)); }
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener("pointerdown", e => { if (!on) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = { c: color, erase: eraser, pts: [pos(e)] }; strokes.push(cur); drawStroke(cur); });
  cv.addEventListener("pointermove", e => { if (!cur) return; cur.pts.push(pos(e)); drawStroke({ ...cur, pts: cur.pts.slice(-2) }); });
  const end = () => { cur = null; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  new ResizeObserver(size).observe(inner); window.addEventListener("resize", size); size();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", redraw);
  return {
    toggle(v) { on = v ?? !on; cv.classList.toggle("on", on); return on; },
    setColor(c) { color = c; eraser = false; }, setEraser(v) { eraser = v; },
    clear() { strokes = []; redraw(); },
    has() { return strokes.some(s => !s.erase && s.pts.length); },
    async toFile() {
      const pts = strokes.filter(s => !s.erase).flatMap(s => s.pts); if (!pts.length) return null;
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 24;
      const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad), x1 = Math.max(...xs) + pad, y1 = Math.max(...ys) + pad;
      const sc = Math.min(2, 1400 / Math.max(x1 - x0, y1 - y0)); const off = document.createElement("canvas"); off.width = Math.ceil((x1 - x0) * sc); off.height = Math.ceil((y1 - y0) * sc);
      const og = off.getContext("2d"); og.fillStyle = "#fff"; og.fillRect(0, 0, off.width, off.height);
      const keep = { k: "#111", b: "#1c54bf", r: "#c2352a", g: "#17784a" };
      strokes.forEach(s => drawStroke(s, og, sc, x0, y0, s.erase ? "#fff" : keep[s.c]));
      return new Promise(res => off.toBlob(b => res(b ? new File([b], "board-work.png", { type: "image/png" }) : null), "image/png"));
    }
  };
})();

/* ================= i18n application ================= */
function applyI18n() {
  document.documentElement.lang = S.ui;
  $$("[data-i18n]").forEach(n => { n.textContent = t(n.dataset.i18n); });
  $$("[data-i18n-aria]").forEach(n => n.setAttribute("aria-label", t(n.dataset.i18nAria)));
  $$("[data-i18n-title]").forEach(n => { n.title = t(n.dataset.i18nTitle); });
  $$("[data-ui-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.uiLang === S.ui)));
  const fill = (sel, keys, cur, prefix) => { sel.innerHTML = keys.map(k => `<option value="${k}">${esc(t(prefix + k))}</option>`).join(""); sel.value = cur; };
  fill($("#subject"), ["auto", "math", "physics", "chem", "bio", "sci", "eng", "thai", "social", "cs"], S.subject, "subject.");
  fill($("#level"), ["primary", "lower", "upper", "uni", "adult"], S.level, "level.");
  input.placeholder = t("ph." + S.mode);
  try { $("#boardDate").textContent = new Intl.DateTimeFormat(S.ui === "th" ? "th-TH-u-ca-buddhist" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()); } catch { /* ignore */ }
  setTitle(L ? L.title : ""); renderPlay(); renderVoice(); renderProvider(); renderQuick();
  if (L && L.steps.length && !P.playing) updateProgress();
  welcome();
}
function setUiLang(l) {
  if (!["th", "en"].includes(l) || l === S.ui) return;
  S.ui = l; S.lang = l; saveS();
  if (L && L.sample) { interrupt(); loadSample(); }
  applyI18n();
  if (L && L.sample) { $("#sayText").textContent = t("sampleCaption"); $("#stepNo").textContent = t("nSteps", { n: L.steps.length }); }
}

/* ================= modes & controls ================= */
function setMode(m, silent) {
  S.mode = m; saveS();
  $$(".mode").forEach(b => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
  $("#examOpts").hidden = m !== "exam";
  input.placeholder = t("ph." + m);
  welcome();
  if (!silent && L && L.active && L.mode !== m) { L.active = false; clearQuick(); addNote(t("modeSwitched", { m: t("modeName." + m) })); }
}
$$(".mode").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
$$("[data-ui-lang]").forEach(b => b.addEventListener("click", () => setUiLang(b.dataset.uiLang)));
$("#quizN").value = S.quizN;
$("#subject").onchange = e => { S.subject = e.target.value; saveS(); };
$("#level").onchange = e => { S.level = e.target.value; saveS(); };
$("#quizN").onchange = e => { S.quizN = e.target.value; saveS(); if (L && L.active) L.quizN = +S.quizN; };
$("#newBtn").onclick = () => { if (ctl) ctl.abort(); newLesson(); L.active = false; setTitle(""); feed.innerHTML = ""; welcome(); addNote(t("newStarted", { m: t("modeName." + S.mode) })); input.focus(); };
$("#playBtn").onclick = () => P.playing ? pause() : play();
$("#nextBtn").onclick = skip; $("#replayBtn").onclick = replay; $("#allBtn").onclick = showAll;
$("#voiceBtn").onclick = () => { S.voiceOn = !S.voiceOn; saveS(); renderVoice(); if (!S.voiceOn) Voice.stop(); };
$("#stopBtn").onclick = () => { if (ctl) ctl.abort(); };
$("#histBtn").onclick = openHistory; $("#histClose").onclick = () => $("#histDlg").close();
$("#penBtn").onclick = () => { const on = ink.toggle(); $("#penBtn").setAttribute("aria-pressed", String(on)); $("#penSet").hidden = !on; };
$$("[data-pen]").forEach(b => b.onclick = () => { ink.setColor(b.dataset.pen); $$("[data-pen]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#eraserBtn").setAttribute("aria-pressed", "false"); });
$("#eraserBtn").onclick = () => { const v = $("#eraserBtn").getAttribute("aria-pressed") !== "true"; ink.setEraser(v); $("#eraserBtn").setAttribute("aria-pressed", String(v)); };
$("#clearInkBtn").onclick = () => ink.clear();
$("#sendInkBtn").onclick = async () => {
  if (!ink.has()) { addNote(t("noInk")); return; }
  const f = await ink.toFile(); if (!f) return;
  const typed = input.value.trim(); input.value = ""; autoGrow();
  ask((typed ? typed + "\n" : "") + t("inkMsg"), { files: [f], display: typed || t("inkDisplay") });
};

/* composer: text, files, voice input */
let atts = [];
function autoGrow() { input.style.height = "auto"; input.style.height = Math.min(180, input.scrollHeight + 2) + "px"; }
input.addEventListener("input", autoGrow);
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer: fine)").matches) { e.preventDefault(); $("#composer").requestSubmit(); } });
$("#composer").addEventListener("submit", e => {
  e.preventDefault(); if (busy) return;
  const txt = input.value, files = atts.slice();
  if (!txt.trim() && !files.length) return;
  if (V.mic) V.mic.stop();
  input.value = ""; autoGrow(); atts = []; renderAtts();
  ask(txt, { files });
});
$("#fileIn").accept = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.pdf,.txt,.md,.csv";
function addFiles(list) {
  for (const f of [...list]) {
    const k = fileKind(f);
    if (!k) { addNote(t("badType", { n: f.name }), true); continue; }
    if (f.size > 20 * 1024 * 1024) { addNote(t("tooBig", { n: f.name }), true); continue; }
    if (V.provider === "claude" && k === "pdf") { addNote(t("noPdfHere"), true); continue; }
    if (V.provider === "claude" && k === "image" && !V.imgLimits) { addNote(t("noImages"), true); continue; }
    atts.push(f);
  }
  atts = atts.slice(0, 10); renderAtts();
}
function renderAtts() {
  const box = $("#atts"); box.innerHTML = "";
  atts.forEach((f, k) => {
    const kind = fileKind(f), d = el("div", kind === "image" ? "att" : "att doc");
    if (kind === "image") { const im = document.createElement("img"); im.alt = f.name; im.src = URL.createObjectURL(f); d.appendChild(im); }
    else d.innerHTML = `<span class="ext">${esc((f.name.split(".").pop() || "").toUpperCase())}</span><span>${esc(f.name)}</span>`;
    const x = el("button", "", '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'); x.type = "button"; x.setAttribute("aria-label", "×"); x.onclick = () => { atts.splice(k, 1); renderAtts(); };
    d.appendChild(x); box.appendChild(d);
  });
}
$("#fileIn").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
input.addEventListener("paste", e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
$(".panel").addEventListener("dragover", e => e.preventDefault());
$(".panel").addEventListener("drop", e => { e.preventDefault(); addFiles(e.dataTransfer.files); });

$("#micBtn").addEventListener("click", () => {
  if (V.dict) {
    if (V.dict.active()) { V.dict.stop().catch(() => {}); return; }
    V.dict.start({ language: S.lang }).catch(e => { const c = e && e.code; if (c === "not_granted" || c === "unavailable") { $("#micBtn").hidden = true; addNote(t("micNA")); } else if (c !== "stopped" && c !== "dismissed") addNote(t("micFail")); });
  } else if (V.sr) {
    if (V.srOn) { V.sr.stop(); return; }
    V.sr.lang = S.lang === "en" ? "en-US" : "th-TH";
    try { V.sr.start(); } catch { addNote(t("micFail")); }
  }
});

/* settings */
function fillVoiceSelects() {
  const th = $("#voiceTh"), en = $("#voiceEn"), hint = $("#voiceHint");
  if (Voice.kind() === "claude") {
    th.innerHTML = ["buttery", "airy", "glassy", "rounded"].map(v => `<option value="${v}">${esc(t("cv." + v))}</option>`).join(""); th.value = S.claudeVoice;
    th.closest(".field").querySelector("label").textContent = t("claudeVoice"); en.closest(".field").hidden = true; hint.textContent = "";
    return;
  }
  th.closest(".field").querySelector("label").textContent = t("voiceTh"); en.closest(".field").hidden = false;
  Voice.loadVoices();
  const opts = lang => `<option value="">${esc(t("autoVoice"))}</option>` + Voice.voices.filter(v => v.lang.toLowerCase().startsWith(lang)).map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join("");
  th.innerHTML = opts("th"); th.value = S.voiceTh; en.innerHTML = opts("en"); en.value = S.voiceEn;
  hint.textContent = Voice.voices.length && !Voice.hasLang("th") ? t("noThaiVoice") : "";
}
function openSettings() {
  const f = $("#setForm");
  f.querySelectorAll("[name=lang]").forEach(r => r.checked = r.value === S.lang);
  f.querySelectorAll("[name=tier]").forEach(r => r.checked = r.value === S.tier);
  $("#rateIn").value = S.rate; $("#rateVal").textContent = "×" + (+S.rate).toFixed(2);
  $("#pwField").hidden = !(V.health && V.health.auth); $("#pwIn").value = S.pw || "";
  fillVoiceSelects();
  $("#setDlg").showModal();
}
function readSettings() {
  const f = $("#setForm");
  S.lang = f.querySelector("[name=lang]:checked")?.value || S.lang;
  S.tier = f.querySelector("[name=tier]:checked")?.value || S.tier;
  S.rate = +$("#rateIn").value || 1; S.pw = $("#pwIn").value;
  if (Voice.kind() === "claude") S.claudeVoice = $("#voiceTh").value || S.claudeVoice; else { S.voiceTh = $("#voiceTh").value; S.voiceEn = $("#voiceEn").value; }
  saveS(); if (V.tts && V.tts.setRate) V.tts.setRate(S.rate).catch(() => {});
}
$("#setBtn").onclick = openSettings;
$("#rateIn").oninput = e => { $("#rateVal").textContent = "×" + (+e.target.value).toFixed(2); };
$("#testVoiceBtn").onclick = () => { readSettings(); Voice.stop(); Voice.speak(S.lang === "en" ? t("testEn") : t("testTh")).catch(() => {}); };
$("#setDlg").addEventListener("close", () => { readSettings(); if (V.provider === "server" || V.provider === "none") checkServer().then(renderProvider); });

function renderProvider() {
  const b = $("#providerBadge"); b.textContent = t("prov." + V.provider);
  $("#attachBtn").hidden = V.provider === "claude" && !V.imgLimits;
  $("#sendInkBtn").hidden = V.provider === "claude" && !V.imgLimits;
  renderVoice();
}

/* ================= connect: Claude app or our server ================= */
async function checkServer() {
  try {
    const r = await fetch("api/health", { cache: "no-store" });
    if (!r.ok) { V.provider = "none"; return; }
    V.health = await r.json();
    V.provider = V.health.ready ? "server" : "nokey";
  } catch { V.provider = "none"; }
}
async function initProvider() {
  const C = window.claude;
  if (C && typeof C.use === "function") {
    const use = n => C.use(n).catch(() => null);
    const [smp, tts, dict] = await Promise.all([use("sample"), use("tts"), use("dictation")]);
    if (smp) {
      V.provider = "claude"; V.sample = smp; V.tts = tts; V.dict = dict;
      try { const lim = await smp.limits(); V.imgLimits = lim && lim.images || null; } catch { V.imgLimits = null; }
      if (tts) {
        V.ttsLangs = await (tts.languages ? tts.languages().catch(() => null) : null);
        tts.onState(({ state, reason }) => { setSpeaking(state === "speaking"); if (state === "idle" && (reason === "not_granted" || reason === "unavailable")) { V.ttsOk = false; renderVoice(); } });
        if (tts.setRate) tts.setRate(S.rate).catch(() => {});
      }
      if (dict) {
        $("#micBtn").hidden = false;
        dict.onState(({ state, reason }) => { const on = state !== "idle"; $("#micBtn").setAttribute("aria-pressed", String(on)); $("#dictHint").hidden = !on; if (on) $("#dictHint").textContent = t("listening"); if (state === "idle" && reason === "unavailable") $("#micBtn").hidden = true; });
        dict.onPartial(({ text }) => { $("#dictHint").textContent = text ? "… " + text : t("listening"); });
        dict.onFinal(({ text }) => { input.value = input.value ? input.value + text : text.trimStart(); autoGrow(); });
        V.mic = { stop: () => dict.stop().catch(() => {}) };
      }
      renderProvider(); return;
    }
  }
  await checkServer();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const sr = new SR(); sr.interimResults = true; sr.continuous = true; V.sr = sr;
    let base = "";
    sr.onstart = () => { V.srOn = true; base = input.value; $("#micBtn").setAttribute("aria-pressed", "true"); $("#dictHint").hidden = false; $("#dictHint").textContent = t("listening"); };
    sr.onend = () => { V.srOn = false; $("#micBtn").setAttribute("aria-pressed", "false"); $("#dictHint").hidden = true; };
    sr.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { $("#micBtn").hidden = true; addNote(t("micNA")); } };
    sr.onresult = e => { let fin = "", part = ""; for (const r of e.results) (r.isFinal ? (fin += r[0].transcript) : (part += r[0].transcript)); input.value = (base ? base + " " : "") + fin; $("#dictHint").textContent = part ? "… " + part : t("listening"); autoGrow(); };
    V.mic = { stop: () => { if (V.srOn) sr.stop(); } };
    $("#micBtn").hidden = false;
  }
  renderProvider();
  if (V.provider === "none") addNote(t("offline"));
  else if (V.provider === "nokey") addNote(t("nokey"), true);
  else if (V.health && V.health.auth && !S.pw) openSettings();
}

/* ================= boot ================= */
setMode(S.mode, true);
applyI18n();
loadSample();
document.addEventListener("keydown", e => {
  if (e.target.closest("textarea,input,select,dialog,button,label")) return;
  if (e.key === " ") { e.preventDefault(); P.playing ? pause() : play(); }
  else if (e.key === "ArrowRight") skip();
});
const providerReady = initProvider();
