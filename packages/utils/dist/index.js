import slug from 'slug';

// src/fmt.ts
var RubIntl2 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
});
var RubIntl0 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});
var RubIntl4 = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 4
});
function toNum(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}
function RubR2(v) {
  const n = toNum(v);
  return n != null ? RubIntl2.format(n) + " \u20BD" : "";
}
function Rub2(v) {
  const n = toNum(v);
  return n != null ? RubIntl2.format(n) : "";
}
function Rub0(v) {
  const n = toNum(v);
  return n != null ? RubIntl0.format(n) : "";
}
function Rub0R(v) {
  const n = toNum(v);
  return n != null ? RubIntl0.format(n) + " \u20BD" : "";
}
function Rub4(v) {
  const n = toNum(v);
  return n != null ? RubIntl4.format(n) : "";
}
function fmtNum(v) {
  const n = toNum(v);
  return n != null ? RubIntl0.format(n) : "\u2014";
}
function fmtPrice(v) {
  const n = toNum(v);
  return n != null ? RubIntl2.format(n) + " \u20BD" : "\u2014";
}
var DateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var DateTimeShortFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
var DateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
var TimeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});
var DateMonthFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric"
});
function toDate(v) {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDateTime(v) {
  const d = toDate(v);
  return d ? DateTimeFmt.format(d) : "";
}
function fmtDateTimeShort(v) {
  const d = toDate(v);
  return d ? DateTimeShortFmt.format(d) : "";
}
function fmtDate(v) {
  const d = toDate(v);
  return d ? DateFmt.format(d) : "";
}
function fmtTime(v) {
  const d = toDate(v);
  return d ? TimeFmt.format(d) : "";
}
function fmtDateMonth(v) {
  const d = toDate(v);
  return d ? DateMonthFmt.format(d) : "";
}
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} \u0411`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} \u041A\u0411`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} \u041C\u0411`;
}
function timeAgo(v) {
  const d = toDate(v);
  if (!d) return "\u2014";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  const minutes = Math.floor(diff / 6e4);
  if (minutes < 1) return "\u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E";
  if (minutes < 60) return `${minutes} \u043C\u0438\u043D. \u043D\u0430\u0437\u0430\u0434`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} \u0447. \u043D\u0430\u0437\u0430\u0434`;
  const days = Math.floor(hours / 24);
  return `${days} \u0434\u043D. \u043D\u0430\u0437\u0430\u0434`;
}
var genSlug = (name) => slug(name);

// src/zip.ts
var IMAGE_EXTS = /* @__PURE__ */ new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);
var MIME_MAP = {
  svg: "image/svg+xml",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg"
};
async function extractImagesFromZip(zipFile) {
  const { unzipSync } = await import('fflate');
  const buf = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(buf);
  const dt = new DataTransfer();
  for (const [name, data] of Object.entries(entries)) {
    if (name.startsWith("__MACOSX/") || name.startsWith(".")) continue;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (!IMAGE_EXTS.has(ext)) continue;
    const mime = MIME_MAP[ext] || "image/jpeg";
    const fileName = name.split("/").pop() || name;
    dt.items.add(new File([data], fileName, { type: mime }));
  }
  return dt.files;
}

// src/imgproxy.ts
var config = {};
function configureImgproxy(c) {
  config = { ...config, ...c };
}
function env(key) {
  const proc = globalThis.process;
  const fromProc = proc?.env?.[key];
  if (fromProc) return fromProc;
  const meta = import.meta;
  return meta.env?.[key];
}
function base64url(input) {
  const Buf = globalThis.Buffer;
  if (Buf) {
    return Buf.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function resolveSource(src) {
  const bucket = config.bucket ?? env("VITE_S3_BUCKET");
  if (!bucket) return src;
  if (src.startsWith("/media/")) return `s3://${bucket}/${src.slice(7)}`;
  const s3Web = (config.webEndpoint ?? env("VITE_S3_WEB_ENDPOINT"))?.replace(/\/$/, "");
  if (s3Web && src.startsWith(s3Web + "/")) return `s3://${bucket}/${src.slice(s3Web.length + 1)}`;
  return src;
}
function buildProcessing(ops) {
  const parts = [];
  if (ops.w || ops.h || ops.fit) {
    const t = ops.fit ?? "fit";
    parts.push(`rs:${t}:${ops.w ?? 0}:${ops.h ?? 0}:${ops.enlarge ? 1 : 0}:${ops.extend ? 1 : 0}`);
  }
  if (ops.dpr && ops.dpr !== 1) parts.push(`dpr:${ops.dpr}`);
  if (ops.gravity) parts.push(`g:${ops.gravity}`);
  if (ops.q) parts.push(`q:${ops.q}`);
  if (ops.bg) parts.push(`bg:${ops.bg.replace(/^#/, "")}`);
  if (ops.blur) parts.push(`bl:${ops.blur}`);
  if (ops.sharpen) parts.push(`sh:${ops.sharpen}`);
  if (ops.padding != null) {
    parts.push(Array.isArray(ops.padding) ? `pd:${ops.padding.join(":")}` : `pd:${ops.padding}`);
  }
  if (ops.preset) {
    parts.push(`pr:${Array.isArray(ops.preset) ? ops.preset.join(":") : ops.preset}`);
  }
  return parts.join("/");
}
function imgproxyUrl(src, opts = {}) {
  const base = (config.baseUrl ?? env("VITE_IMGPROXY_URL"))?.replace(/\/$/, "");
  if (!base || !src) return src;
  const processing = buildProcessing({ fit: "fill", ...opts });
  const ext = opts.format ? `.${opts.format}` : "";
  return `${base}/insecure/${processing}/${base64url(resolveSource(src))}${ext}`;
}

export { Rub0, Rub0R, Rub2, Rub4, RubR2, configureImgproxy, extractImagesFromZip, fmtDate, fmtDateMonth, fmtDateTime, fmtDateTimeShort, fmtNum, fmtPrice, fmtSize, fmtTime, genSlug, imgproxyUrl, timeAgo };
