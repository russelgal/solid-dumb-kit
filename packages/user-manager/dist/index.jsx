// src/DumbUserManager.tsx
import { For, Show, createSignal } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
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
    void run(
      "create",
      async () => {
        await onCreate({ name: name().trim(), email: email().trim(), password: pass, role: role() });
        setName("");
        setEmail("");
        setPassword("");
      },
      t("createdOk")(pass)
    );
  };
  const rolesHint = () => roles().map((r) => r.label + " \u2014 " + (r.hint ?? "")).filter((s) => s.trim().length > 2).join(" \xB7 ");
  return <div class={"dumb-um" + (props.class ? " " + props.class : "")}>
      <Show when={(props.title ?? t("title")) !== ""}>
        <h1 class="dumb-um-title">{props.title ?? t("title")}</h1>
      </Show>

      <Show when={props.onCreate}>
        <div class="dumb-um-card">
          <h2 class="dumb-um-card-title">{t("createTitle")}</h2>
          <form class="dumb-um-form" onSubmit={create}>
            <label class="dumb-um-field">
              {t("name")}
              <input
    class="dumb-um-input"
    style={{ width: "11rem" }}
    value={name()}
    onInput={(e) => setName(e.currentTarget.value)}
    required
  />
            </label>
            <label class="dumb-um-field">
              {t("email")}
              <input
    class="dumb-um-input"
    style={{ width: "13rem" }}
    type="email"
    autocomplete="off"
    value={email()}
    onInput={(e) => setEmail(e.currentTarget.value)}
    required
  />
            </label>
            <label class="dumb-um-field" title={t("passwordEmpty")}>
              {t("password")}
              <input
    class="dumb-um-input"
    style={{ width: "12rem" }}
    type="text"
    autocomplete="off"
    placeholder={t("passwordEmpty")}
    value={password()}
    onInput={(e) => setPassword(e.currentTarget.value)}
  />
            </label>
            <Show when={roles().length > 0}>
              <select
    class="dumb-um-select"
    style={{ width: "10rem" }}
    value={role()}
    onChange={(e) => setRole(e.currentTarget.value)}
  >
                <For each={roles()}>{(r) => <option value={r.value}>{r.label}</option>}</For>
              </select>
            </Show>
            <button class="dumb-um-btn" data-kind="primary" disabled={busy() === "create"}>
              <Show when={busy() === "create"} fallback={t("submit")}>
                <span class="dumb-um-spin" />
              </Show>
            </button>
          </form>
          <Show when={rolesHint()}>
            {
    /* подсказку про роли читают, а не проглядывают: без приглушения */
  }
            <p class="dumb-um-hint">{rolesHint()}</p>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div role="alert" class="dumb-um-alert" data-kind="error">
          {error()}
        </div>
      </Show>
      <Show when={notice()}>
        <div role="alert" class="dumb-um-alert" data-kind="ok">
          {notice()}
        </div>
      </Show>

      <div class="dumb-um-table-box">
        <table class="dumb-um-table">
          <thead>
            <tr>
              <th>{t("colUser")}</th>
              <th>{t("colRole")}</th>
              <th>{t("colAccess")}</th>
              <th>{t("colCreated")}</th>
              <th>{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.users}>
              {(u) => <tr class="dumb-um-row" data-banned={u.banned ? "1" : void 0}>
                  <td>
                    <div class="dumb-um-name">
                      {u.name}
                      <Show when={isSelf(u.id)}>
                        <span class="dumb-um-badge">{t("you")}</span>
                      </Show>
                      <Show when={u.isOwner}>
                        <span class="dumb-um-badge" title={t("ownerHint")}>
                          {t("owner")}
                        </span>
                      </Show>
                    </div>
                    <div class="dumb-um-mail">{u.email}</div>
                  </td>

                  <td>
                    <Show
    when={props.onSetRole && roles().length > 0}
    fallback={roles().find((r) => r.value === u.role)?.label ?? u.role}
  >
                      <select
    class="dumb-um-select"
    style={{ width: "9rem" }}
    value={u.role}
    disabled={busy() === "role:" + u.id || locked(u)}
    onChange={(e) => void run("role:" + u.id, () => props.onSetRole(u.id, e.currentTarget.value))}
  >
                        <For each={roles()}>{(r) => <option value={r.value}>{r.label}</option>}</For>
                      </select>
                    </Show>
                  </td>

                  <td>
                    <Show
    when={u.banned}
    fallback={<span class="dumb-um-state" data-banned="0">
                          {t("active")}
                          <Show when={u.sessions !== void 0 && u.sessions > 0}>
                            <span class="dumb-um-sessions">
                              {" \xB7 " + t("sessions") + ": " + u.sessions}
                            </span>
                          </Show>
                        </span>}
  >
                      <span class="dumb-um-state" data-banned="1" title={u.banReason ?? ""}>
                        {t("banned")}
                      </span>
                    </Show>
                  </td>

                  <td class="dumb-um-date">{fmt(u.createdAt)}</td>

                  <td>
                    <div class="dumb-um-actions">
                      <Show when={props.onSetPassword}>
                        <button
    class="dumb-um-btn"
    disabled={locked(u)}
    title={locked(u) ? t("ownerPasswordHint") : t("setPasswordHint")}
    onClick={() => {
      setPwFor(pwFor() === u.id ? null : u.id);
      setPwValue(suggestPassword());
    }}
  >
                          {t("setPassword")}
                        </button>
                      </Show>

                      <Show when={u.banned ? props.onUnban : props.onBan}>
                        <Show
    when={u.banned}
    fallback={<button
      class="dumb-um-btn"
      disabled={isSelf(u.id) || locked(u) || busy() === "ban:" + u.id}
      title={locked(u) ? t("banOwnerHint") : isSelf(u.id) ? t("banSelfHint") : t("banHint")}
      onClick={() => void run("ban:" + u.id, () => props.onBan(u.id, ""), t("bannedOk"))}
    >
                              {t("ban")}
                            </button>}
  >
                          <button
    class="dumb-um-btn"
    data-kind="ok"
    disabled={busy() === "unban:" + u.id}
    onClick={() => void run("unban:" + u.id, () => props.onUnban(u.id), t("unbannedOk"))}
  >
                            {t("unban")}
                          </button>
                        </Show>
                      </Show>

                      <Show when={props.onRevokeSessions}>
                        <button
    class="dumb-um-btn"
    disabled={busy() === "revoke:" + u.id || u.sessions === 0 || locked(u)}
    title={t("revokeHint")}
    onClick={() => void run(
      "revoke:" + u.id,
      () => props.onRevokeSessions(u.id),
      t("revokedOk")
    )}
  >
                          {t("revoke")}
                        </button>
                      </Show>

                      <Show when={props.onRemove}>
                        <Show
    when={confirmRemove() === u.id}
    fallback={<button
      class="dumb-um-btn"
      data-kind="danger"
      disabled={isSelf(u.id) || locked(u)}
      title={locked(u) ? t("removeOwnerHint") : isSelf(u.id) ? t("removeSelfHint") : t("removeHint")}
      onClick={() => setConfirmRemove(u.id)}
    >
                              {t("remove")}
                            </button>}
  >
                          <button
    class="dumb-um-btn"
    data-kind="danger-solid"
    disabled={busy() === "remove:" + u.id}
    onClick={() => void run(
      "remove:" + u.id,
      async () => {
        await props.onRemove(u.id);
        setConfirmRemove(null);
      },
      t("removedOk")
    )}
  >
                            {t("removeConfirm")}
                          </button>
                          <button class="dumb-um-btn" onClick={() => setConfirmRemove(null)}>
                            {t("cancel")}
                          </button>
                        </Show>
                      </Show>
                    </div>

                    <Show when={pwFor() === u.id}>
                      <form
    class="dumb-um-pw"
    onSubmit={(e) => {
      e.preventDefault();
      const value = pwValue();
      void run(
        "pw:" + u.id,
        async () => {
          await props.onSetPassword(u.id, value);
          setPwFor(null);
        },
        t("passwordSetOk")(u, value)
      );
    }}
  >
                        <input
    class="dumb-um-input"
    style={{ width: "11rem" }}
    value={pwValue()}
    onInput={(e) => setPwValue(e.currentTarget.value)}
    autocomplete="off"
  />
                        <button
    class="dumb-um-btn"
    data-kind="primary"
    disabled={busy() === "pw:" + u.id}
  >
                          {t("apply")}
                        </button>
                        <button type="button" class="dumb-um-btn" onClick={() => setPwFor(null)}>
                          {t("cancel")}
                        </button>
                      </form>
                    </Show>
                  </td>
                </tr>}
            </For>
          </tbody>
        </table>
      </div>
    </div>;
}
export {
  DumbUserManager,
  suggestPassword
};
