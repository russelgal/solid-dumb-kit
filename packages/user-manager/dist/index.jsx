// src/DumbUserManager.tsx
import { For, Show, createSignal } from "solid-js";

// src/password.ts
var ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789ACDEFGHJKLMNPQRSTUVWXYZ";
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
function DumbUserManager(props) {
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
  return <div class={"flex flex-col gap-4" + (props.class ? " " + props.class : "")}>
      <Show when={(props.title ?? t("title")) !== ""}>
        <h1 class="text-xl font-bold">{props.title ?? t("title")}</h1>
      </Show>

      <Show when={props.onCreate}>
        <div class="bg-base-100 rounded-box border-base-300 border p-4 shadow-sm">
          <h2 class="mb-3 font-semibold">{t("createTitle")}</h2>
          <form class="flex flex-wrap items-end gap-2" onSubmit={create}>
            <label class="input input-sm w-48">
              <span class="label">{t("name")}</span>
              <input value={name()} onInput={(e) => setName(e.currentTarget.value)} required />
            </label>
            <label class="input input-sm w-56">
              <span class="label">{t("email")}</span>
              <input
    type="email"
    autocomplete="off"
    value={email()}
    onInput={(e) => setEmail(e.currentTarget.value)}
    required
  />
            </label>
            <label class="input input-sm w-52" title={t("passwordEmpty")}>
              <span class="label">{t("password")}</span>
              <input
    type="text"
    autocomplete="off"
    placeholder={t("passwordEmpty")}
    value={password()}
    onInput={(e) => setPassword(e.currentTarget.value)}
  />
            </label>
            <Show when={roles().length > 0}>
              <select
    class="select select-sm w-44"
    value={role()}
    onChange={(e) => setRole(e.currentTarget.value)}
  >
                <For each={roles()}>{(r) => <option value={r.value}>{r.label}</option>}</For>
              </select>
            </Show>
            <button class="btn btn-sm btn-neutral" disabled={busy() === "create"}>
              <Show when={busy() === "create"} fallback={t("submit")}>
                <span class="loading loading-spinner loading-sm" />
              </Show>
            </button>
          </form>
          <Show when={rolesHint()}>
            {
    /* подсказку про роли читают, а не проглядывают: без приглушения */
  }
            <p class="text-base-content mt-2 text-xs">{rolesHint()}</p>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div role="alert" class="alert alert-error py-2 text-sm">
          {error()}
        </div>
      </Show>
      <Show when={notice()}>
        <div role="alert" class="alert alert-success py-2 text-sm">
          {notice()}
        </div>
      </Show>

      <div class="bg-base-100 rounded-box border-base-300 overflow-x-auto border shadow-sm">
        <table class="table">
          <thead>
            <tr>
              <th>{t("colUser")}</th>
              <th>{t("colRole")}</th>
              <th>{t("colAccess")}</th>
              <th>{t("colCreated")}</th>
              <th class="text-right">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.users}>
              {(u) => (
    // заблокированную строку помечаем фоном, а не прозрачностью:
    // выцветший текст в ките запрещён, а прочитать его всё равно надо
    <tr class={u.banned ? "bg-base-200" : ""}>
                  <td>
                    <div class="font-medium">
                      {u.name}
                      <Show when={isSelf(u.id)}>
                        <span class="badge badge-ghost badge-sm ml-2">{t("you")}</span>
                      </Show>
                      <Show when={u.isOwner}>
                        <span class="badge badge-neutral badge-sm ml-2" title={t("ownerHint")}>
                          {t("owner")}
                        </span>
                      </Show>
                    </div>
                    <div class="text-base-content text-xs">{u.email}</div>
                  </td>

                  <td>
                    <Show
      when={props.onSetRole && roles().length > 0}
      fallback={roles().find((r) => r.value === u.role)?.label ?? u.role}
    >
                      <select
      class="select select-sm w-36"
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
      fallback={<span class="text-success text-xs">
                          {t("active")}
                          <Show when={u.sessions !== void 0 && u.sessions > 0}>
                            <span class="text-base-content">
                              {" \xB7 " + t("sessions") + ": " + u.sessions}
                            </span>
                          </Show>
                        </span>}
    >
                      <span class="text-error text-xs" title={u.banReason ?? ""}>
                        {t("banned")}
                      </span>
                    </Show>
                  </td>

                  <td class="text-base-content text-sm whitespace-nowrap">{fmt(u.createdAt)}</td>

                  <td>
                    <div class="flex flex-wrap justify-end gap-1">
                      <Show when={props.onSetPassword}>
                        <button
      class="btn btn-sm btn-ghost"
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
        class="btn btn-sm btn-ghost"
        disabled={isSelf(u.id) || locked(u) || busy() === "ban:" + u.id}
        title={locked(u) ? t("banOwnerHint") : isSelf(u.id) ? t("banSelfHint") : t("banHint")}
        onClick={() => void run("ban:" + u.id, () => props.onBan(u.id, ""), t("bannedOk"))}
      >
                              {t("ban")}
                            </button>}
    >
                          <button
      class="btn btn-sm btn-ghost text-success"
      disabled={busy() === "unban:" + u.id}
      onClick={() => void run("unban:" + u.id, () => props.onUnban(u.id), t("unbannedOk"))}
    >
                            {t("unban")}
                          </button>
                        </Show>
                      </Show>

                      <Show when={props.onRevokeSessions}>
                        <button
      class="btn btn-sm btn-ghost"
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
        class="btn btn-sm btn-ghost text-error"
        disabled={isSelf(u.id) || locked(u)}
        title={locked(u) ? t("removeOwnerHint") : isSelf(u.id) ? t("removeSelfHint") : t("removeHint")}
        onClick={() => setConfirmRemove(u.id)}
      >
                              {t("remove")}
                            </button>}
    >
                          <button
      class="btn btn-sm btn-error"
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
                          <button class="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(null)}>
                            {t("cancel")}
                          </button>
                        </Show>
                      </Show>
                    </div>

                    <Show when={pwFor() === u.id}>
                      <form
      class="mt-2 flex justify-end gap-1"
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
      class="input input-sm w-44"
      value={pwValue()}
      onInput={(e) => setPwValue(e.currentTarget.value)}
      autocomplete="off"
    />
                        <button class="btn btn-sm btn-neutral" disabled={busy() === "pw:" + u.id}>
                          {t("apply")}
                        </button>
                        <button type="button" class="btn btn-sm btn-ghost" onClick={() => setPwFor(null)}>
                          {t("cancel")}
                        </button>
                      </form>
                    </Show>
                  </td>
                </tr>
  )}
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
