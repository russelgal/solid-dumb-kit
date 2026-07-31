// src/odataClient.ts
var OdataError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "OdataError";
  }
  status;
};
var JSON_NOMETA = "application/json;odata=nometadata";
function toBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function odataString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}
function parseODataError(text) {
  try {
    const clean = text.replace(/^﻿/, "");
    const json = JSON.parse(clean);
    return json?.["odata.error"]?.message?.value ?? null;
  } catch {
    return null;
  }
}
var OdataClient = class {
  baseUrl;
  token;
  fetchFn;
  timeoutMs;
  constructor(opts) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token ?? toBase64(`${opts.login ?? ""}:${opts.password ?? ""}`);
    this.fetchFn = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 3e4;
  }
  /** Сборка URL: параметры кодируются вручную (`%20`, не `+`) */
  url(resource, params = {}) {
    const all = {
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      $format: JSON_NOMETA
    };
    const qs = Object.entries(all).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    return `${this.baseUrl}/${encodeURI(resource)}?${qs}`;
  }
  async request(resource, params = {}, init = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetchFn(this.url(resource, params), {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Basic ${this.token}`,
          Accept: "application/json",
          ...init.body !== void 0 ? { "Content-Type": "application/json" } : {}
        },
        body: init.body !== void 0 ? JSON.stringify(init.body) : void 0,
        signal: ctrl.signal
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new OdataError(`1\u0421 OData: \u0442\u0430\u0439\u043C\u0430\u0443\u0442 ${this.timeoutMs}\u043C\u0441`);
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    if (!res.ok) {
      const msg = parseODataError(text);
      if (res.status === 401) throw new OdataError("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C 1\u0421", 401);
      throw new OdataError(msg ?? `1\u0421 OData HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
    }
    if (!text.trim()) return void 0;
    const json = JSON.parse(text.replace(/^﻿/, ""));
    const err = json["odata.error"];
    if (err) throw new OdataError(err.message?.value ?? JSON.stringify(err).slice(0, 200));
    return json;
  }
  /** GET сущности/набора */
  get(resource, params) {
    return this.request(resource, params);
  }
  /** GET набора → массив `value` */
  async list(resource, params) {
    const resp = await this.request(resource, params);
    return resp.value ?? [];
  }
  /** Точечное чтение по ключу: `Entity(guid'...')` — работает даже при запрете `$filter` */
  one(entity, refKey, select) {
    return this.request(`${entity}(guid'${refKey}')`, select ? { $select: select } : {});
  }
  /** Точное число записей набора (опционально — с `$filter`) */
  async count(resource, filter) {
    const params = {
      $top: 0,
      $inlinecount: "allpages",
      $select: "Ref_Key"
    };
    if (filter) params.$filter = filter;
    const resp = await this.request(resource, params);
    return Number(resp["odata.count"]) || 0;
  }
  /**
   * Страница «свежие сверху» хронологического набора, когда `$orderby`
   * игнорируется/запрещён: читаем кусок с конца через `$skip` и разворачиваем.
   * `filter` (опционально) применяется и к count, и к странице — поиск
   * с пагинацией поверх того же приёма.
   */
  async tailPage(resource, opts) {
    const total = await this.count(resource, opts.filter);
    const end = Math.max(0, total - (opts.page - 1) * opts.pageSize);
    const skip = Math.max(0, end - opts.pageSize);
    const top = end - skip;
    if (top <= 0) return { rows: [], total };
    const params = { $skip: skip, $top: top };
    if (opts.select) params.$select = opts.select;
    if (opts.filter) params.$filter = opts.filter;
    const rows = await this.list(resource, params);
    return { rows: rows.reverse(), total };
  }
};
function createOdataClient(opts) {
  return new OdataClient(opts);
}

export { OdataClient, OdataError, createOdataClient, odataString, toBase64 };
