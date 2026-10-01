import { delegateEvents, insert, createComponent, effect, setAttribute, memo, className, template } from '@solidjs/web';
import { createSignal, Show, For } from 'solid-js';

// src/DumbUserManager.tsx

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
var _tmpl$ = /* @__PURE__ */ template(`<h1 class="text-xl font-bold">`);
var _tmpl$2 = /* @__PURE__ */ template(`<select class="select select-sm w-44">`);
var _tmpl$3 = /* @__PURE__ */ template(`<span class="loading loading-spinner loading-sm">`);
var _tmpl$4 = /* @__PURE__ */ template(`<p class="text-base-content mt-2 text-xs">`);
var _tmpl$5 = /* @__PURE__ */ template(`<div class="bg-base-100 rounded-box border-base-300 border p-4 shadow-sm"><h2 class="mb-3 font-semibold"></h2><form class="flex flex-wrap items-end gap-2"><label class="input input-sm w-48"><span class=label></span><input required></label><label class="input input-sm w-56"><span class=label></span><input type=email autocomplete=off required></label><label class="input input-sm w-52"><span class=label></span><input type=text autocomplete=off></label><button class="btn btn-sm btn-neutral">`);
var _tmpl$6 = /* @__PURE__ */ template(`<div role=alert class="alert alert-error py-2 text-sm">`);
var _tmpl$7 = /* @__PURE__ */ template(`<div role=alert class="alert alert-success py-2 text-sm">`);
var _tmpl$8 = /* @__PURE__ */ template(`<div><!><!><!><div class="bg-base-100 rounded-box border-base-300 overflow-x-auto border shadow-sm"><table class=table><thead><tr><th></th><th></th><th></th><th></th><th class=text-right></th></tr></thead><tbody>`);
var _tmpl$9 = /* @__PURE__ */ template(`<option>`);
var _tmpl$0 = /* @__PURE__ */ template(`<tr><td><div class=font-medium><!><!><!></div><div class="text-base-content text-xs"></div></td><td></td><td></td><td class="text-base-content text-sm whitespace-nowrap"></td><td><div class="flex flex-wrap justify-end gap-1"><!><!><!><!>`);
var _tmpl$1 = /* @__PURE__ */ template(`<span class="badge badge-ghost badge-sm ml-2">`);
var _tmpl$10 = /* @__PURE__ */ template(`<span class="badge badge-neutral badge-sm ml-2">`);
var _tmpl$11 = /* @__PURE__ */ template(`<select class="select select-sm w-36">`);
var _tmpl$12 = /* @__PURE__ */ template(`<span class="text-error text-xs">`);
var _tmpl$13 = /* @__PURE__ */ template(`<span class="text-success text-xs"><!><!>`);
var _tmpl$14 = /* @__PURE__ */ template(`<span class=text-base-content>`);
var _tmpl$15 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost">`);
var _tmpl$16 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost text-success">`);
var _tmpl$17 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-error">`);
var _tmpl$18 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost text-error">`);
var _tmpl$19 = /* @__PURE__ */ template(`<form class="mt-2 flex justify-end gap-1"><input class="input input-sm w-44"autocomplete=off><button class="btn btn-sm btn-neutral"></button><button type=button class="btn btn-sm btn-ghost">`);
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
  var _el$ = _tmpl$8(), _el$29 = _el$.firstChild, _el$30 = _el$29.nextSibling, _el$31 = _el$30.nextSibling, _el$19 = _el$31.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild, _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling, _el$25 = _el$24.nextSibling, _el$26 = _el$25.nextSibling, _el$27 = _el$26.nextSibling, _el$28 = _el$21.nextSibling;
  insert(_el$, createComponent(Show, {
    get when() {
      return (props.title ?? t("title")) !== "";
    },
    get children() {
      var _el$2 = _tmpl$();
      insert(_el$2, () => props.title ?? t("title"));
      return _el$2;
    }
  }), _el$29);
  insert(_el$, createComponent(Show, {
    get when() {
      return props.onCreate;
    },
    get children() {
      var _el$3 = _tmpl$5(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$6.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$0.nextSibling, _el$10 = _el$9.nextSibling, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling, _el$14 = _el$10.nextSibling;
      insert(_el$4, () => t("createTitle"));
      _el$5.addEventListener("submit", create);
      insert(_el$7, () => t("name"));
      _el$8.$$input = (e) => setName(e.currentTarget.value);
      insert(_el$0, () => t("email"));
      _el$1.$$input = (e) => setEmail(e.currentTarget.value);
      insert(_el$11, () => t("password"));
      _el$12.$$input = (e) => setPassword(e.currentTarget.value);
      insert(_el$5, createComponent(Show, {
        get when() {
          return roles().length > 0;
        },
        get children() {
          var _el$13 = _tmpl$2();
          _el$13.addEventListener("change", (e) => setRole(e.currentTarget.value));
          insert(_el$13, createComponent(For, {
            get each() {
              return roles();
            },
            children: (r) => (() => {
              var _el$32 = _tmpl$9();
              insert(_el$32, () => r.label);
              effect(() => r.value, (_v$) => {
                _el$32.value = _v$;
              });
              return _el$32;
            })()
          }));
          effect(() => role(), (_v$) => {
            queueMicrotask(() => _el$13.value = _v$) || (_el$13.value = _v$);
          });
          return _el$13;
        }
      }), _el$14);
      insert(_el$14, createComponent(Show, {
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
          var _el$16 = _tmpl$4();
          insert(_el$16, rolesHint);
          return _el$16;
        }
      }), null);
      effect(() => ({
        e: name(),
        t: email(),
        a: t("passwordEmpty"),
        o: t("passwordEmpty"),
        i: password(),
        n: busy() === "create"
      }), ({
        e,
        t: t2,
        a,
        o,
        i,
        n
      }, _p$) => {
        _el$8.value = e ?? "";
        _el$1.value = t2 ?? "";
        a !== _p$?.a && setAttribute(_el$10, "title", a);
        o !== _p$?.o && setAttribute(_el$12, "placeholder", o);
        _el$12.value = i ?? "";
        n !== _p$?.n && setAttribute(_el$14, "disabled", n);
      });
      return _el$3;
    }
  }), _el$30);
  insert(_el$, createComponent(Show, {
    get when() {
      return error();
    },
    get children() {
      var _el$17 = _tmpl$6();
      insert(_el$17, error);
      return _el$17;
    }
  }), _el$31);
  insert(_el$, createComponent(Show, {
    get when() {
      return notice();
    },
    get children() {
      var _el$18 = _tmpl$7();
      insert(_el$18, notice);
      return _el$18;
    }
  }), _el$19);
  insert(_el$23, () => t("colUser"));
  insert(_el$24, () => t("colRole"));
  insert(_el$25, () => t("colAccess"));
  insert(_el$26, () => t("colCreated"));
  insert(_el$27, () => t("colActions"));
  insert(_el$28, createComponent(For, {
    get each() {
      return props.users;
    },
    children: (u) => (
      // заблокированную строку помечаем фоном, а не прозрачностью:
      // выцветший текст в ките запрещён, а прочитать его всё равно надо
      //
      // ⚠️ Внутри строки — условия в разметке, а не <Show>: строк
      // десятки, и по дюжине компонентов на каждую (каждый со своим
      // владельцем и мемо) делали создание таблицы самым дорогим
      // местом экрана. Условие в разметке — одно вычисление; узлы
      // появляются и пропадают с ним так же.
      (() => {
        var _el$33 = _tmpl$0(), _el$34 = _el$33.firstChild, _el$35 = _el$34.firstChild, _el$36 = _el$35.firstChild, _el$37 = _el$36.nextSibling, _el$38 = _el$37.nextSibling, _el$39 = _el$35.nextSibling, _el$40 = _el$34.nextSibling, _el$41 = _el$40.nextSibling, _el$42 = _el$41.nextSibling, _el$43 = _el$42.nextSibling, _el$44 = _el$43.firstChild, _el$45 = _el$44.firstChild, _el$46 = _el$45.nextSibling, _el$47 = _el$46.nextSibling, _el$48 = _el$47.nextSibling;
        insert(_el$35, () => u.name, _el$36);
        insert(_el$35, (() => {
          var _c$ = memo(() => !!isSelf(u.id));
          return () => _c$() ? (() => {
            var _el$49 = _tmpl$1();
            insert(_el$49, () => t("you"));
            return _el$49;
          })() : isSelf(u.id);
        })(), _el$37);
        insert(_el$35, (() => {
          var _c$2 = memo(() => !!u.isOwner);
          return () => _c$2() ? (() => {
            var _el$50 = _tmpl$10();
            insert(_el$50, () => t("owner"));
            effect(() => t("ownerHint"), (_v$) => {
              setAttribute(_el$50, "title", _v$);
            });
            return _el$50;
          })() : u.isOwner;
        })(), _el$38);
        insert(_el$39, () => u.email);
        insert(_el$40, (() => {
          var _c$3 = memo(() => !!(props.onSetRole && roles().length > 0));
          return () => _c$3() ? (() => {
            var _el$51 = _tmpl$11();
            _el$51.addEventListener("change", (e) => void run("role:" + u.id, () => props.onSetRole(u.id, e.currentTarget.value)));
            insert(_el$51, createComponent(For, {
              get each() {
                return roles();
              },
              children: (r) => (() => {
                var _el$52 = _tmpl$9();
                insert(_el$52, () => r.label);
                effect(() => r.value, (_v$) => {
                  _el$52.value = _v$;
                });
                return _el$52;
              })()
            }));
            effect(() => ({
              e: u.role,
              t: busy() === "role:" + u.id || locked(u)
            }), ({
              e,
              t: t2
            }, _p$) => {
              queueMicrotask(() => _el$51.value = e) || (_el$51.value = e);
              t2 !== _p$?.t && setAttribute(_el$51, "disabled", t2);
            });
            return _el$51;
          })() : roles().find((r) => r.value === u.role)?.label ?? u.role;
        })());
        insert(_el$41, (() => {
          var _c$4 = memo(() => !!u.banned);
          return () => _c$4() ? (() => {
            var _el$53 = _tmpl$12();
            insert(_el$53, () => t("banned"));
            effect(() => u.banReason ?? "", (_v$) => {
              setAttribute(_el$53, "title", _v$);
            });
            return _el$53;
          })() : (() => {
            var _el$54 = _tmpl$13(), _el$55 = _el$54.firstChild, _el$56 = _el$55.nextSibling;
            insert(_el$54, () => t("active"), _el$55);
            insert(_el$54, (() => {
              var _c$0 = memo(() => !!(u.sessions !== void 0 && u.sessions > 0));
              return () => _c$0() ? (() => {
                var _el$57 = _tmpl$14();
                insert(_el$57, () => " \xB7 " + t("sessions") + ": " + u.sessions);
                return _el$57;
              })() : u.sessions !== void 0 && u.sessions > 0;
            })(), _el$56);
            return _el$54;
          })();
        })());
        insert(_el$42, () => fmt(u.createdAt));
        insert(_el$44, (() => {
          var _c$5 = memo(() => !!props.onSetPassword);
          return () => _c$5() ? (() => {
            var _el$58 = _tmpl$15();
            _el$58.$$click = () => {
              setPwFor(pwFor() === u.id ? null : u.id);
              setPwValue(suggestPassword());
            };
            insert(_el$58, () => t("setPassword"));
            effect(() => ({
              e: locked(u),
              t: locked(u) ? t("ownerPasswordHint") : t("setPasswordHint")
            }), ({
              e,
              t: t2
            }, _p$) => {
              e !== _p$?.e && setAttribute(_el$58, "disabled", e);
              t2 !== _p$?.t && setAttribute(_el$58, "title", t2);
            });
            return _el$58;
          })() : props.onSetPassword;
        })(), _el$45);
        insert(_el$44, (() => {
          var _c$6 = memo(() => !!u.banned);
          return () => _c$6() ? memo(() => !!props.onUnban)() ? (() => {
            var _el$59 = _tmpl$16();
            _el$59.$$click = () => void run("unban:" + u.id, () => props.onUnban(u.id), t("unbannedOk"));
            insert(_el$59, () => t("unban"));
            effect(() => busy() === "unban:" + u.id, (_v$) => {
              setAttribute(_el$59, "disabled", _v$);
            });
            return _el$59;
          })() : props.onUnban : memo(() => !!props.onBan)() ? (() => {
            var _el$60 = _tmpl$15();
            _el$60.$$click = () => void run("ban:" + u.id, () => props.onBan(u.id, ""), t("bannedOk"));
            insert(_el$60, () => t("ban"));
            effect(() => ({
              e: isSelf(u.id) || locked(u) || busy() === "ban:" + u.id,
              t: locked(u) ? t("banOwnerHint") : isSelf(u.id) ? t("banSelfHint") : t("banHint")
            }), ({
              e,
              t: t2
            }, _p$) => {
              e !== _p$?.e && setAttribute(_el$60, "disabled", e);
              t2 !== _p$?.t && setAttribute(_el$60, "title", t2);
            });
            return _el$60;
          })() : props.onBan;
        })(), _el$46);
        insert(_el$44, (() => {
          var _c$7 = memo(() => !!props.onRevokeSessions);
          return () => _c$7() ? (() => {
            var _el$61 = _tmpl$15();
            _el$61.$$click = () => void run("revoke:" + u.id, () => props.onRevokeSessions(u.id), t("revokedOk"));
            insert(_el$61, () => t("revoke"));
            effect(() => ({
              e: busy() === "revoke:" + u.id || u.sessions === 0 || locked(u),
              t: t("revokeHint")
            }), ({
              e,
              t: t2
            }, _p$) => {
              e !== _p$?.e && setAttribute(_el$61, "disabled", e);
              t2 !== _p$?.t && setAttribute(_el$61, "title", t2);
            });
            return _el$61;
          })() : props.onRevokeSessions;
        })(), _el$47);
        insert(_el$44, (() => {
          var _c$8 = memo(() => !!props.onRemove);
          return () => _c$8() ? confirmRemove() === u.id ? [(() => {
            var _el$62 = _tmpl$17();
            _el$62.$$click = () => void run("remove:" + u.id, async () => {
              await props.onRemove(u.id);
              setConfirmRemove(null);
            }, t("removedOk"));
            insert(_el$62, () => t("removeConfirm"));
            effect(() => busy() === "remove:" + u.id, (_v$) => {
              setAttribute(_el$62, "disabled", _v$);
            });
            return _el$62;
          })(), (() => {
            var _el$63 = _tmpl$15();
            _el$63.$$click = () => setConfirmRemove(null);
            insert(_el$63, () => t("cancel"));
            return _el$63;
          })()] : (() => {
            var _el$64 = _tmpl$18();
            _el$64.$$click = () => setConfirmRemove(u.id);
            insert(_el$64, () => t("remove"));
            effect(() => ({
              e: isSelf(u.id) || locked(u),
              t: locked(u) ? t("removeOwnerHint") : isSelf(u.id) ? t("removeSelfHint") : t("removeHint")
            }), ({
              e,
              t: t2
            }, _p$) => {
              e !== _p$?.e && setAttribute(_el$64, "disabled", e);
              t2 !== _p$?.t && setAttribute(_el$64, "title", t2);
            });
            return _el$64;
          })() : props.onRemove;
        })(), _el$48);
        insert(_el$43, (() => {
          var _c$9 = memo(() => pwFor() === u.id);
          return () => _c$9() && (() => {
            var _el$65 = _tmpl$19(), _el$66 = _el$65.firstChild, _el$67 = _el$66.nextSibling, _el$68 = _el$67.nextSibling;
            _el$65.addEventListener("submit", (e) => {
              e.preventDefault();
              const value = pwValue();
              void run("pw:" + u.id, async () => {
                await props.onSetPassword(u.id, value);
                setPwFor(null);
              }, t("passwordSetOk")(u, value));
            });
            _el$66.$$input = (e) => setPwValue(e.currentTarget.value);
            insert(_el$67, () => t("apply"));
            _el$68.$$click = () => setPwFor(null);
            insert(_el$68, () => t("cancel"));
            effect(() => ({
              e: pwValue(),
              t: busy() === "pw:" + u.id
            }), ({
              e,
              t: t2
            }, _p$) => {
              _el$66.value = e ?? "";
              t2 !== _p$?.t && setAttribute(_el$67, "disabled", t2);
            });
            return _el$65;
          })();
        })(), null);
        effect(() => u.banned ? "bg-base-200" : "", (_v$, _$p) => {
          className(_el$33, _v$, _$p);
        });
        return _el$33;
      })()
    )
  }));
  effect(() => "flex flex-col gap-4" + (props.class ? " " + props.class : ""), (_v$, _$p) => {
    className(_el$, _v$, _$p);
  });
  return _el$;
}
delegateEvents(["input", "click"]);

export { DumbUserManager, suggestPassword };
