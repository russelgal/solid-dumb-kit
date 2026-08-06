import { delegateEvents, insert, createComponent, effect, setAttribute, memo, className, template } from 'solid-js/web';
import { createSignal, Show, For } from 'solid-js';

// src/DumbUserManager.tsx
var done = /* @__PURE__ */ new Set();
function injectStyle(id, css) {
  if (typeof document === "undefined") return;
  if (done.has(id)) return;
  done.add(id);
  const was = document.querySelector(`style[data-dumb-kit="${id}"]`);
  if (was) {
    if (was.textContent !== css) was.textContent = css;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
}

// src/password.ts
var ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789ACDEFGHJKLMNPQRSTUVWXY";
function suggestPassword(length = 9) {
  const limit = 256 - 256 % ALPHABET.length;
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length - out.length + 4);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

// src/DumbUserManager.tsx
var _tmpl$ = /* @__PURE__ */ template(`<h1 class=dumb-um-title>`);
var _tmpl$2 = /* @__PURE__ */ template(`<select class=dumb-um-select style=width:10rem>`);
var _tmpl$3 = /* @__PURE__ */ template(`<span class=dumb-um-spin>`);
var _tmpl$4 = /* @__PURE__ */ template(`<p class=dumb-um-hint>`);
var _tmpl$5 = /* @__PURE__ */ template(`<div class=dumb-um-card><h2 class=dumb-um-card-title></h2><form class=dumb-um-form><label class=dumb-um-field><input class=dumb-um-input required style=width:11rem></label><label class=dumb-um-field><input class=dumb-um-input type=email autocomplete=off required style=width:13rem></label><label class=dumb-um-field><input class=dumb-um-input type=text autocomplete=off style=width:12rem></label><button class=dumb-um-btn data-kind=primary>`);
var _tmpl$6 = /* @__PURE__ */ template(`<div role=alert class=dumb-um-alert data-kind=error>`);
var _tmpl$7 = /* @__PURE__ */ template(`<div role=alert class=dumb-um-alert data-kind=ok>`);
var _tmpl$8 = /* @__PURE__ */ template(`<div><div class=dumb-um-table-box><table class=dumb-um-table><thead><tr><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody>`);
var _tmpl$9 = /* @__PURE__ */ template(`<option>`);
var _tmpl$0 = /* @__PURE__ */ template(`<span class=dumb-um-badge>`);
var _tmpl$1 = /* @__PURE__ */ template(`<select class=dumb-um-select style=width:9rem>`);
var _tmpl$10 = /* @__PURE__ */ template(`<span class=dumb-um-state data-banned=1>`);
var _tmpl$11 = /* @__PURE__ */ template(`<button class=dumb-um-btn>`);
var _tmpl$12 = /* @__PURE__ */ template(`<button class=dumb-um-btn data-kind=ok>`);
var _tmpl$13 = /* @__PURE__ */ template(`<button class=dumb-um-btn data-kind=danger-solid>`);
var _tmpl$14 = /* @__PURE__ */ template(`<form class=dumb-um-pw><input class=dumb-um-input autocomplete=off style=width:11rem><button class=dumb-um-btn data-kind=primary></button><button type=button class=dumb-um-btn>`);
var _tmpl$15 = /* @__PURE__ */ template(`<tr class=dumb-um-row><td><div class=dumb-um-name></div><div class=dumb-um-mail></div></td><td></td><td></td><td class=dumb-um-date></td><td><div class=dumb-um-actions>`);
var _tmpl$16 = /* @__PURE__ */ template(`<span class=dumb-um-sessions>`);
var _tmpl$17 = /* @__PURE__ */ template(`<span class=dumb-um-state data-banned=0>`);
var _tmpl$18 = /* @__PURE__ */ template(`<button class=dumb-um-btn data-kind=danger>`);
var RU = {
  title: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438",
  createTitle: "\u0412\u044B\u0434\u0430\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F",
  name: "\u0418\u043C\u044F",
  email: "\u041F\u043E\u0447\u0442\u0430",
  password: "\u041F\u0430\u0440\u043E\u043B\u044C",
  passwordEmpty: "\u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u0443\u0441\u0442\u044B\u043C \u2014 \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0435\u043C",
  submit: "\u0417\u0430\u0432\u0435\u0441\u0442\u0438",
  colUser: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A",
  colRole: "\u0420\u043E\u043B\u044C",
  colAccess: "\u0414\u043E\u0441\u0442\u0443\u043F",
  colCreated: "\u0417\u0430\u0432\u0435\u0434\u0451\u043D",
  colActions: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F",
  you: "\u044D\u0442\u043E \u0432\u044B",
  owner: "\u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446",
  ownerHint: "\u0412\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u0441\u0438\u0441\u0442\u0435\u043C\u044B: \u0437\u0430\u0449\u0438\u0449\u0451\u043D \u043E\u0442 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439",
  active: "\u0430\u043A\u0442\u0438\u0432\u0435\u043D",
  sessions: "\u0441\u0435\u0441\u0441\u0438\u0439",
  banned: "\u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D",
  setPassword: "\u041F\u0430\u0440\u043E\u043B\u044C",
  setPasswordHint: "\u0417\u0430\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C",
  ownerPasswordHint: "\u041F\u0430\u0440\u043E\u043B\u044C \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u043C \u0441\u0430\u043C\u0438\u043C",
  apply: "\u0417\u0430\u0434\u0430\u0442\u044C",
  cancel: "\u041E\u0442\u043C\u0435\u043D\u0430",
  ban: "\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  banHint: "\u041F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F",
  banSelfHint: "\u0421\u0435\u0431\u044F \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F",
  banOwnerHint: "\u0412\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F",
  unban: "\u0420\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  revoke: "\u0412\u044B\u043A\u0438\u043D\u0443\u0442\u044C",
  revokeHint: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u0432\u0441\u0435 \u0441\u0435\u0441\u0441\u0438\u0438 \u2014 \u043F\u0440\u0438\u0434\u0451\u0442\u0441\u044F \u0432\u043E\u0439\u0442\u0438 \u0437\u0430\u043D\u043E\u0432\u043E",
  remove: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
  removeHint: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F",
  removeSelfHint: "\u0421\u0435\u0431\u044F \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F",
  removeOwnerHint: "\u0412\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F",
  removeConfirm: "\u0422\u043E\u0447\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C",
  failed: "\u041D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C",
  bannedOk: "\u0414\u043E\u0441\u0442\u0443\u043F \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D",
  unbannedOk: "\u0414\u043E\u0441\u0442\u0443\u043F \u0432\u0435\u0440\u043D\u0443\u043B\u0438",
  revokedOk: "\u0421\u0435\u0441\u0441\u0438\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B",
  removedOk: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0443\u0434\u0430\u043B\u0451\u043D",
  createdOk: (pass) => "\u0414\u043E\u0441\u0442\u0443\u043F \u0432\u044B\u0434\u0430\u043D. \u041F\u0430\u0440\u043E\u043B\u044C: " + pass + " \u2014 \u043F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0443, \u0432\u0442\u043E\u0440\u043E\u0439 \u0440\u0430\u0437 \u043E\u043D \u043D\u0435 \u043F\u043E\u043A\u0430\u0436\u0435\u0442\u0441\u044F.",
  passwordSetOk: (user, pass) => "\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0434\u043B\u044F " + user.name + ": " + pass
};
var STYLES = `
  .dumb-um { display: flex; flex-direction: column; gap: 16px; font-size: 14px;
             color: var(--dumb-um-fg, #0f172a) }
  .dumb-um-title { margin: 0; font-size: 20px; font-weight: 700 }
  .dumb-um-card { padding: 14px; background: var(--dumb-um-bg, #fff);
                  border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .14));
                  border-radius: var(--dumb-um-radius, 10px) }
  .dumb-um-card-title { margin: 0 0 10px; font-size: 15px; font-weight: 600 }

  .dumb-um-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px }
  .dumb-um-field { display: flex; flex-direction: column; gap: 3px; font-size: 12px;
                   color: var(--dumb-um-dim, #475569) }
  .dumb-um-input, .dumb-um-select {
    font: inherit; font-size: 13px; padding: 5px 8px; color: var(--dumb-um-fg, #0f172a);
    background: var(--dumb-um-bg, #fff);
    border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .28));
    border-radius: calc(var(--dumb-um-radius, 10px) - 4px) }
  .dumb-um-input:focus-visible, .dumb-um-select:focus-visible,
  .dumb-um-btn:focus-visible { outline: 2px solid var(--dumb-um-accent, #2563eb);
                               outline-offset: 1px }
  .dumb-um-hint { margin: 8px 0 0; font-size: 12px; color: var(--dumb-um-dim, #475569) }

  .dumb-um-btn { font: inherit; font-size: 13px; padding: 5px 10px; cursor: pointer;
                 white-space: nowrap; color: var(--dumb-um-fg, #0f172a);
                 background: none; border: 1px solid transparent;
                 border-radius: calc(var(--dumb-um-radius, 10px) - 4px) }
  .dumb-um-btn:hover:not([disabled]) { background: var(--dumb-um-hover, rgb(0 0 0 / .07)) }
  .dumb-um-btn[disabled] { cursor: default; color: var(--dumb-um-off, #64748b) }
  .dumb-um-btn[data-kind="primary"] { color: #fff; font-weight: 600;
                                      background: var(--dumb-um-primary, #1e293b) }
  .dumb-um-btn[data-kind="primary"]:hover:not([disabled]) {
    background: var(--dumb-um-primary-hover, #0f172a) }
  .dumb-um-btn[data-kind="danger"] { color: var(--dumb-um-bad, #b91c1c) }
  .dumb-um-btn[data-kind="danger-solid"] { color: #fff; font-weight: 600;
                                           background: var(--dumb-um-bad, #b91c1c) }
  .dumb-um-btn[data-kind="ok"] { color: var(--dumb-um-ok, #15803d) }

  /* \u043A\u0440\u0443\u0442\u0438\u043B\u043A\u0430 \u0432\u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0434\u043F\u0438\u0441\u0438, \u043F\u043E\u043A\u0430 \u0438\u0434\u0451\u0442 \u0437\u0430\u043F\u0440\u043E\u0441: \u043A\u043D\u043E\u043F\u043A\u0430 \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043C\u0435\u043D\u044F\u0442\u044C \u0448\u0438\u0440\u0438\u043D\u0443 */
  .dumb-um-spin { display: inline-block; width: 13px; height: 13px; vertical-align: -2px;
                  border: 2px solid currentColor; border-right-color: transparent;
                  border-radius: 50%; animation: dumb-um-spin .7s linear infinite }
  @keyframes dumb-um-spin { to { rotate: 1turn } }
  @media (prefers-reduced-motion: reduce) { .dumb-um-spin { animation: none } }

  .dumb-um-alert { padding: 8px 12px; font-size: 13px;
                   border-radius: var(--dumb-um-radius, 10px);
                   border: 1px solid currentColor }
  .dumb-um-alert[data-kind="error"] { color: var(--dumb-um-bad, #b91c1c);
                                      background: var(--dumb-um-bad-bg, rgb(185 28 28 / .08)) }
  .dumb-um-alert[data-kind="ok"] { color: var(--dumb-um-ok, #15803d);
                                   background: var(--dumb-um-ok-bg, rgb(21 128 61 / .08)) }

  .dumb-um-table-box { overflow-x: auto; background: var(--dumb-um-bg, #fff);
                       border: 1px solid var(--dumb-um-line, rgb(0 0 0 / .14));
                       border-radius: var(--dumb-um-radius, 10px) }
  .dumb-um-table { width: 100%; border-collapse: collapse }
  .dumb-um-table th, .dumb-um-table td { padding: 8px 12px; text-align: left;
                                         vertical-align: top;
                                         border-bottom: 1px solid var(--dumb-um-line, rgb(0 0 0 / .12)) }
  .dumb-um-table tr:last-child td { border-bottom: 0 }
  .dumb-um-table th { font-size: 12px; font-weight: 600;
                      color: var(--dumb-um-dim, #475569) }
  .dumb-um-table th:last-child, .dumb-um-actions { text-align: right }
  /* \u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u043E\u043A\u0443 \u043F\u043E\u043C\u0435\u0447\u0430\u0435\u043C \u0424\u041E\u041D\u041E\u041C, \u0430 \u043D\u0435 \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C\u044E: \u0432\u044B\u0446\u0432\u0435\u0442\u0448\u0438\u0439 \u0442\u0435\u043A\u0441\u0442
     \u0432 \u043A\u0438\u0442\u0435 \u0437\u0430\u043F\u0440\u0435\u0449\u0451\u043D, \u0430 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0442\u0440\u043E\u043A\u0443 \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u043D\u0430\u0434\u043E \u2014 \u0437\u0430 \u0447\u0442\u043E \u0438 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043B\u0438 */
  .dumb-um-row[data-banned="1"] { background: var(--dumb-um-row-off, rgb(0 0 0 / .05)) }

  .dumb-um-name { font-weight: 500 }
  .dumb-um-mail, .dumb-um-date { font-size: 12px; color: var(--dumb-um-dim, #475569) }
  .dumb-um-date { white-space: nowrap }
  .dumb-um-badge { margin-left: 6px; padding: 1px 6px; font-size: 11px; font-weight: 500;
                   border-radius: 999px; color: var(--dumb-um-fg, #0f172a);
                   background: var(--dumb-um-hover, rgb(0 0 0 / .09)) }
  .dumb-um-state { font-size: 12px }
  .dumb-um-state[data-banned="1"] { color: var(--dumb-um-bad, #b91c1c); font-weight: 600 }
  .dumb-um-state[data-banned="0"] { color: var(--dumb-um-ok, #15803d) }
  .dumb-um-sessions { color: var(--dumb-um-dim, #475569) }
  .dumb-um-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px }
  .dumb-um-pw { display: flex; justify-content: flex-end; gap: 4px; margin-top: 8px }
`;
function DumbUserManager(props) {
  injectStyle("user-manager", STYLES);
  const t = (key) => props.labels?.[key] ?? RU[key];
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [role, setRole] = createSignal(props.defaultRole ?? props.roles?.[0]?.value ?? "");
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [busy, setBusy] = createSignal("");
  const [pwFor, setPwFor] = createSignal(null);
  const [pwValue, setPwValue] = createSignal("");
  const [confirmRemove, setConfirmRemove] = createSignal(null);
  const roles = () => props.roles ?? [];
  const fmt = (iso) => props.formatDate ? props.formatDate(iso) : iso;
  const isSelf = (id) => id === props.currentUserId;
  const locked = (u) => Boolean(u.isOwner);
  const run = async (key, fn, ok) => {
    setError("");
    setNotice("");
    setBusy(key);
    try {
      await fn();
      if (ok) setNotice(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setBusy("");
    }
  };
  const create = (e) => {
    e.preventDefault();
    const onCreate = props.onCreate;
    if (!onCreate) return;
    const pass = password() || suggestPassword();
    void run("create", async () => {
      await onCreate({
        name: name().trim(),
        email: email().trim(),
        password: pass,
        role: role()
      });
      setName("");
      setEmail("");
      setPassword("");
    }, t("createdOk")(pass));
  };
  const rolesHint = () => roles().map((r) => r.label + " \u2014 " + (r.hint ?? "")).filter((s) => s.trim().length > 2).join(" \xB7 ");
  return (() => {
    var _el$ = _tmpl$8(), _el$16 = _el$.firstChild, _el$17 = _el$16.firstChild, _el$18 = _el$17.firstChild, _el$19 = _el$18.firstChild, _el$20 = _el$19.firstChild, _el$21 = _el$20.nextSibling, _el$22 = _el$21.nextSibling, _el$23 = _el$22.nextSibling, _el$24 = _el$23.nextSibling, _el$25 = _el$18.nextSibling;
    insert(_el$, createComponent(Show, {
      get when() {
        return (props.title ?? t("title")) !== "";
      },
      get children() {
        var _el$2 = _tmpl$();
        insert(_el$2, () => props.title ?? t("title"));
        return _el$2;
      }
    }), _el$16);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.onCreate;
      },
      get children() {
        var _el$3 = _tmpl$5(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$6.firstChild, _el$8 = _el$6.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$8.nextSibling, _el$1 = _el$0.firstChild, _el$11 = _el$0.nextSibling;
        insert(_el$4, () => t("createTitle"));
        _el$5.addEventListener("submit", create);
        insert(_el$6, () => t("name"), _el$7);
        _el$7.$$input = (e) => setName(e.currentTarget.value);
        insert(_el$8, () => t("email"), _el$9);
        _el$9.$$input = (e) => setEmail(e.currentTarget.value);
        insert(_el$0, () => t("password"), _el$1);
        _el$1.$$input = (e) => setPassword(e.currentTarget.value);
        insert(_el$5, createComponent(Show, {
          get when() {
            return roles().length > 0;
          },
          get children() {
            var _el$10 = _tmpl$2();
            _el$10.addEventListener("change", (e) => setRole(e.currentTarget.value));
            insert(_el$10, createComponent(For, {
              get each() {
                return roles();
              },
              children: (r) => (() => {
                var _el$26 = _tmpl$9();
                insert(_el$26, () => r.label);
                effect(() => _el$26.value = r.value);
                return _el$26;
              })()
            }));
            effect(() => _el$10.value = role());
            return _el$10;
          }
        }), _el$11);
        insert(_el$11, createComponent(Show, {
          get when() {
            return busy() === "create";
          },
          get fallback() {
            return t("submit");
          },
          get children() {
            return _tmpl$3();
          }
        }));
        insert(_el$3, createComponent(Show, {
          get when() {
            return rolesHint();
          },
          get children() {
            var _el$13 = _tmpl$4();
            insert(_el$13, rolesHint);
            return _el$13;
          }
        }), null);
        effect((_p$) => {
          var _v$ = t("passwordEmpty"), _v$2 = t("passwordEmpty"), _v$3 = busy() === "create";
          _v$ !== _p$.e && setAttribute(_el$0, "title", _p$.e = _v$);
          _v$2 !== _p$.t && setAttribute(_el$1, "placeholder", _p$.t = _v$2);
          _v$3 !== _p$.a && (_el$11.disabled = _p$.a = _v$3);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        effect(() => _el$7.value = name());
        effect(() => _el$9.value = email());
        effect(() => _el$1.value = password());
        return _el$3;
      }
    }), _el$16);
    insert(_el$, createComponent(Show, {
      get when() {
        return error();
      },
      get children() {
        var _el$14 = _tmpl$6();
        insert(_el$14, error);
        return _el$14;
      }
    }), _el$16);
    insert(_el$, createComponent(Show, {
      get when() {
        return notice();
      },
      get children() {
        var _el$15 = _tmpl$7();
        insert(_el$15, notice);
        return _el$15;
      }
    }), _el$16);
    insert(_el$20, () => t("colUser"));
    insert(_el$21, () => t("colRole"));
    insert(_el$22, () => t("colAccess"));
    insert(_el$23, () => t("colCreated"));
    insert(_el$24, () => t("colActions"));
    insert(_el$25, createComponent(For, {
      get each() {
        return props.users;
      },
      children: (u) => (() => {
        var _el$27 = _tmpl$15(), _el$28 = _el$27.firstChild, _el$29 = _el$28.firstChild, _el$32 = _el$29.nextSibling, _el$33 = _el$28.nextSibling, _el$35 = _el$33.nextSibling, _el$37 = _el$35.nextSibling, _el$38 = _el$37.nextSibling, _el$39 = _el$38.firstChild;
        insert(_el$29, () => u.name, null);
        insert(_el$29, createComponent(Show, {
          get when() {
            return isSelf(u.id);
          },
          get children() {
            var _el$30 = _tmpl$0();
            insert(_el$30, () => t("you"));
            return _el$30;
          }
        }), null);
        insert(_el$29, createComponent(Show, {
          get when() {
            return u.isOwner;
          },
          get children() {
            var _el$31 = _tmpl$0();
            insert(_el$31, () => t("owner"));
            effect(() => setAttribute(_el$31, "title", t("ownerHint")));
            return _el$31;
          }
        }), null);
        insert(_el$32, () => u.email);
        insert(_el$33, createComponent(Show, {
          get when() {
            return memo(() => !!props.onSetRole)() && roles().length > 0;
          },
          get fallback() {
            return roles().find((r) => r.value === u.role)?.label ?? u.role;
          },
          get children() {
            var _el$34 = _tmpl$1();
            _el$34.addEventListener("change", (e) => void run("role:" + u.id, () => props.onSetRole(u.id, e.currentTarget.value)));
            insert(_el$34, createComponent(For, {
              get each() {
                return roles();
              },
              children: (r) => (() => {
                var _el$49 = _tmpl$9();
                insert(_el$49, () => r.label);
                effect(() => _el$49.value = r.value);
                return _el$49;
              })()
            }));
            effect(() => _el$34.disabled = busy() === "role:" + u.id || locked(u));
            effect(() => _el$34.value = u.role);
            return _el$34;
          }
        }));
        insert(_el$35, createComponent(Show, {
          get when() {
            return u.banned;
          },
          get fallback() {
            return (() => {
              var _el$50 = _tmpl$17();
              insert(_el$50, () => t("active"), null);
              insert(_el$50, createComponent(Show, {
                get when() {
                  return memo(() => u.sessions !== void 0)() && u.sessions > 0;
                },
                get children() {
                  var _el$51 = _tmpl$16();
                  insert(_el$51, () => " \xB7 " + t("sessions") + ": " + u.sessions);
                  return _el$51;
                }
              }), null);
              return _el$50;
            })();
          },
          get children() {
            var _el$36 = _tmpl$10();
            insert(_el$36, () => t("banned"));
            effect(() => setAttribute(_el$36, "title", u.banReason ?? ""));
            return _el$36;
          }
        }));
        insert(_el$37, () => fmt(u.createdAt));
        insert(_el$39, createComponent(Show, {
          get when() {
            return props.onSetPassword;
          },
          get children() {
            var _el$40 = _tmpl$11();
            _el$40.$$click = () => {
              setPwFor(pwFor() === u.id ? null : u.id);
              setPwValue(suggestPassword());
            };
            insert(_el$40, () => t("setPassword"));
            effect((_p$) => {
              var _v$4 = locked(u), _v$5 = locked(u) ? t("ownerPasswordHint") : t("setPasswordHint");
              _v$4 !== _p$.e && (_el$40.disabled = _p$.e = _v$4);
              _v$5 !== _p$.t && setAttribute(_el$40, "title", _p$.t = _v$5);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$40;
          }
        }), null);
        insert(_el$39, createComponent(Show, {
          get when() {
            return memo(() => !!u.banned)() ? props.onUnban : props.onBan;
          },
          get children() {
            return createComponent(Show, {
              get when() {
                return u.banned;
              },
              get fallback() {
                return (() => {
                  var _el$52 = _tmpl$11();
                  _el$52.$$click = () => void run("ban:" + u.id, () => props.onBan(u.id, ""), t("bannedOk"));
                  insert(_el$52, () => t("ban"));
                  effect((_p$) => {
                    var _v$8 = isSelf(u.id) || locked(u) || busy() === "ban:" + u.id, _v$9 = locked(u) ? t("banOwnerHint") : isSelf(u.id) ? t("banSelfHint") : t("banHint");
                    _v$8 !== _p$.e && (_el$52.disabled = _p$.e = _v$8);
                    _v$9 !== _p$.t && setAttribute(_el$52, "title", _p$.t = _v$9);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$52;
                })();
              },
              get children() {
                var _el$41 = _tmpl$12();
                _el$41.$$click = () => void run("unban:" + u.id, () => props.onUnban(u.id), t("unbannedOk"));
                insert(_el$41, () => t("unban"));
                effect(() => _el$41.disabled = busy() === "unban:" + u.id);
                return _el$41;
              }
            });
          }
        }), null);
        insert(_el$39, createComponent(Show, {
          get when() {
            return props.onRevokeSessions;
          },
          get children() {
            var _el$42 = _tmpl$11();
            _el$42.$$click = () => void run("revoke:" + u.id, () => props.onRevokeSessions(u.id), t("revokedOk"));
            insert(_el$42, () => t("revoke"));
            effect((_p$) => {
              var _v$6 = busy() === "revoke:" + u.id || u.sessions === 0 || locked(u), _v$7 = t("revokeHint");
              _v$6 !== _p$.e && (_el$42.disabled = _p$.e = _v$6);
              _v$7 !== _p$.t && setAttribute(_el$42, "title", _p$.t = _v$7);
              return _p$;
            }, {
              e: void 0,
              t: void 0
            });
            return _el$42;
          }
        }), null);
        insert(_el$39, createComponent(Show, {
          get when() {
            return props.onRemove;
          },
          get children() {
            return createComponent(Show, {
              get when() {
                return confirmRemove() === u.id;
              },
              get fallback() {
                return (() => {
                  var _el$53 = _tmpl$18();
                  _el$53.$$click = () => setConfirmRemove(u.id);
                  insert(_el$53, () => t("remove"));
                  effect((_p$) => {
                    var _v$0 = isSelf(u.id) || locked(u), _v$1 = locked(u) ? t("removeOwnerHint") : isSelf(u.id) ? t("removeSelfHint") : t("removeHint");
                    _v$0 !== _p$.e && (_el$53.disabled = _p$.e = _v$0);
                    _v$1 !== _p$.t && setAttribute(_el$53, "title", _p$.t = _v$1);
                    return _p$;
                  }, {
                    e: void 0,
                    t: void 0
                  });
                  return _el$53;
                })();
              },
              get children() {
                return [(() => {
                  var _el$43 = _tmpl$13();
                  _el$43.$$click = () => void run("remove:" + u.id, async () => {
                    await props.onRemove(u.id);
                    setConfirmRemove(null);
                  }, t("removedOk"));
                  insert(_el$43, () => t("removeConfirm"));
                  effect(() => _el$43.disabled = busy() === "remove:" + u.id);
                  return _el$43;
                })(), (() => {
                  var _el$44 = _tmpl$11();
                  _el$44.$$click = () => setConfirmRemove(null);
                  insert(_el$44, () => t("cancel"));
                  return _el$44;
                })()];
              }
            });
          }
        }), null);
        insert(_el$38, createComponent(Show, {
          get when() {
            return pwFor() === u.id;
          },
          get children() {
            var _el$45 = _tmpl$14(), _el$46 = _el$45.firstChild, _el$47 = _el$46.nextSibling, _el$48 = _el$47.nextSibling;
            _el$45.addEventListener("submit", (e) => {
              e.preventDefault();
              const value = pwValue();
              void run("pw:" + u.id, async () => {
                await props.onSetPassword(u.id, value);
                setPwFor(null);
              }, t("passwordSetOk")(u, value));
            });
            _el$46.$$input = (e) => setPwValue(e.currentTarget.value);
            insert(_el$47, () => t("apply"));
            _el$48.$$click = () => setPwFor(null);
            insert(_el$48, () => t("cancel"));
            effect(() => _el$47.disabled = busy() === "pw:" + u.id);
            effect(() => _el$46.value = pwValue());
            return _el$45;
          }
        }), null);
        effect(() => setAttribute(_el$27, "data-banned", u.banned ? "1" : void 0));
        return _el$27;
      })()
    }));
    effect(() => className(_el$, "dumb-um" + (props.class ? " " + props.class : "")));
    return _el$;
  })();
}
delegateEvents(["input", "click"]);

export { DumbUserManager, suggestPassword };
