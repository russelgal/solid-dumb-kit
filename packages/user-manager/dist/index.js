import { delegateEvents, insert, createComponent, effect, setAttribute, memo, className, template } from 'solid-js/web';
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
var _tmpl$8 = /* @__PURE__ */ template(`<div><div class="bg-base-100 rounded-box border-base-300 overflow-x-auto border shadow-sm"><table class=table><thead><tr><th></th><th></th><th></th><th></th><th class=text-right></th></tr></thead><tbody>`);
var _tmpl$9 = /* @__PURE__ */ template(`<option>`);
var _tmpl$0 = /* @__PURE__ */ template(`<span class="badge badge-ghost badge-sm ml-2">`);
var _tmpl$1 = /* @__PURE__ */ template(`<span class="badge badge-neutral badge-sm ml-2">`);
var _tmpl$10 = /* @__PURE__ */ template(`<select class="select select-sm w-36">`);
var _tmpl$11 = /* @__PURE__ */ template(`<span class="text-error text-xs">`);
var _tmpl$12 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost">`);
var _tmpl$13 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost text-success">`);
var _tmpl$14 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-error">`);
var _tmpl$15 = /* @__PURE__ */ template(`<form class="mt-2 flex justify-end gap-1"><input class="input input-sm w-44"autocomplete=off><button class="btn btn-sm btn-neutral"></button><button type=button class="btn btn-sm btn-ghost">`);
var _tmpl$16 = /* @__PURE__ */ template(`<tr><td><div class=font-medium></div><div class="text-base-content text-xs"></div></td><td></td><td></td><td class="text-base-content text-sm whitespace-nowrap"></td><td><div class="flex flex-wrap justify-end gap-1">`);
var _tmpl$17 = /* @__PURE__ */ template(`<span class=text-base-content>`);
var _tmpl$18 = /* @__PURE__ */ template(`<span class="text-success text-xs">`);
var _tmpl$19 = /* @__PURE__ */ template(`<button class="btn btn-sm btn-ghost text-error">`);
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
  return (() => {
    var _el$ = _tmpl$8(), _el$19 = _el$.firstChild, _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild, _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling, _el$25 = _el$24.nextSibling, _el$26 = _el$25.nextSibling, _el$27 = _el$26.nextSibling, _el$28 = _el$21.nextSibling;
    insert(_el$, createComponent(Show, {
      get when() {
        return (props.title ?? t("title")) !== "";
      },
      get children() {
        var _el$2 = _tmpl$();
        insert(_el$2, () => props.title ?? t("title"));
        return _el$2;
      }
    }), _el$19);
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
                var _el$29 = _tmpl$9();
                insert(_el$29, () => r.label);
                effect(() => _el$29.value = r.value);
                return _el$29;
              })()
            }));
            effect(() => _el$13.value = role());
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
        effect((_p$) => {
          var _v$ = t("passwordEmpty"), _v$2 = t("passwordEmpty"), _v$3 = busy() === "create";
          _v$ !== _p$.e && setAttribute(_el$10, "title", _p$.e = _v$);
          _v$2 !== _p$.t && setAttribute(_el$12, "placeholder", _p$.t = _v$2);
          _v$3 !== _p$.a && (_el$14.disabled = _p$.a = _v$3);
          return _p$;
        }, {
          e: void 0,
          t: void 0,
          a: void 0
        });
        effect(() => _el$8.value = name());
        effect(() => _el$1.value = email());
        effect(() => _el$12.value = password());
        return _el$3;
      }
    }), _el$19);
    insert(_el$, createComponent(Show, {
      get when() {
        return error();
      },
      get children() {
        var _el$17 = _tmpl$6();
        insert(_el$17, error);
        return _el$17;
      }
    }), _el$19);
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
        (() => {
          var _el$30 = _tmpl$16(), _el$31 = _el$30.firstChild, _el$32 = _el$31.firstChild, _el$35 = _el$32.nextSibling, _el$36 = _el$31.nextSibling, _el$38 = _el$36.nextSibling, _el$40 = _el$38.nextSibling, _el$41 = _el$40.nextSibling, _el$42 = _el$41.firstChild;
          insert(_el$32, () => u.name, null);
          insert(_el$32, createComponent(Show, {
            get when() {
              return isSelf(u.id);
            },
            get children() {
              var _el$33 = _tmpl$0();
              insert(_el$33, () => t("you"));
              return _el$33;
            }
          }), null);
          insert(_el$32, createComponent(Show, {
            get when() {
              return u.isOwner;
            },
            get children() {
              var _el$34 = _tmpl$1();
              insert(_el$34, () => t("owner"));
              effect(() => setAttribute(_el$34, "title", t("ownerHint")));
              return _el$34;
            }
          }), null);
          insert(_el$35, () => u.email);
          insert(_el$36, createComponent(Show, {
            get when() {
              return memo(() => !!props.onSetRole)() && roles().length > 0;
            },
            get fallback() {
              return roles().find((r) => r.value === u.role)?.label ?? u.role;
            },
            get children() {
              var _el$37 = _tmpl$10();
              _el$37.addEventListener("change", (e) => void run("role:" + u.id, () => props.onSetRole(u.id, e.currentTarget.value)));
              insert(_el$37, createComponent(For, {
                get each() {
                  return roles();
                },
                children: (r) => (() => {
                  var _el$52 = _tmpl$9();
                  insert(_el$52, () => r.label);
                  effect(() => _el$52.value = r.value);
                  return _el$52;
                })()
              }));
              effect(() => _el$37.disabled = busy() === "role:" + u.id || locked(u));
              effect(() => _el$37.value = u.role);
              return _el$37;
            }
          }));
          insert(_el$38, createComponent(Show, {
            get when() {
              return u.banned;
            },
            get fallback() {
              return (() => {
                var _el$53 = _tmpl$18();
                insert(_el$53, () => t("active"), null);
                insert(_el$53, createComponent(Show, {
                  get when() {
                    return memo(() => u.sessions !== void 0)() && u.sessions > 0;
                  },
                  get children() {
                    var _el$54 = _tmpl$17();
                    insert(_el$54, () => " \xB7 " + t("sessions") + ": " + u.sessions);
                    return _el$54;
                  }
                }), null);
                return _el$53;
              })();
            },
            get children() {
              var _el$39 = _tmpl$11();
              insert(_el$39, () => t("banned"));
              effect(() => setAttribute(_el$39, "title", u.banReason ?? ""));
              return _el$39;
            }
          }));
          insert(_el$40, () => fmt(u.createdAt));
          insert(_el$42, createComponent(Show, {
            get when() {
              return props.onSetPassword;
            },
            get children() {
              var _el$43 = _tmpl$12();
              _el$43.$$click = () => {
                setPwFor(pwFor() === u.id ? null : u.id);
                setPwValue(suggestPassword());
              };
              insert(_el$43, () => t("setPassword"));
              effect((_p$) => {
                var _v$4 = locked(u), _v$5 = locked(u) ? t("ownerPasswordHint") : t("setPasswordHint");
                _v$4 !== _p$.e && (_el$43.disabled = _p$.e = _v$4);
                _v$5 !== _p$.t && setAttribute(_el$43, "title", _p$.t = _v$5);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$43;
            }
          }), null);
          insert(_el$42, createComponent(Show, {
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
                    var _el$55 = _tmpl$12();
                    _el$55.$$click = () => void run("ban:" + u.id, () => props.onBan(u.id, ""), t("bannedOk"));
                    insert(_el$55, () => t("ban"));
                    effect((_p$) => {
                      var _v$8 = isSelf(u.id) || locked(u) || busy() === "ban:" + u.id, _v$9 = locked(u) ? t("banOwnerHint") : isSelf(u.id) ? t("banSelfHint") : t("banHint");
                      _v$8 !== _p$.e && (_el$55.disabled = _p$.e = _v$8);
                      _v$9 !== _p$.t && setAttribute(_el$55, "title", _p$.t = _v$9);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$55;
                  })();
                },
                get children() {
                  var _el$44 = _tmpl$13();
                  _el$44.$$click = () => void run("unban:" + u.id, () => props.onUnban(u.id), t("unbannedOk"));
                  insert(_el$44, () => t("unban"));
                  effect(() => _el$44.disabled = busy() === "unban:" + u.id);
                  return _el$44;
                }
              });
            }
          }), null);
          insert(_el$42, createComponent(Show, {
            get when() {
              return props.onRevokeSessions;
            },
            get children() {
              var _el$45 = _tmpl$12();
              _el$45.$$click = () => void run("revoke:" + u.id, () => props.onRevokeSessions(u.id), t("revokedOk"));
              insert(_el$45, () => t("revoke"));
              effect((_p$) => {
                var _v$6 = busy() === "revoke:" + u.id || u.sessions === 0 || locked(u), _v$7 = t("revokeHint");
                _v$6 !== _p$.e && (_el$45.disabled = _p$.e = _v$6);
                _v$7 !== _p$.t && setAttribute(_el$45, "title", _p$.t = _v$7);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$45;
            }
          }), null);
          insert(_el$42, createComponent(Show, {
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
                    var _el$56 = _tmpl$19();
                    _el$56.$$click = () => setConfirmRemove(u.id);
                    insert(_el$56, () => t("remove"));
                    effect((_p$) => {
                      var _v$0 = isSelf(u.id) || locked(u), _v$1 = locked(u) ? t("removeOwnerHint") : isSelf(u.id) ? t("removeSelfHint") : t("removeHint");
                      _v$0 !== _p$.e && (_el$56.disabled = _p$.e = _v$0);
                      _v$1 !== _p$.t && setAttribute(_el$56, "title", _p$.t = _v$1);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$56;
                  })();
                },
                get children() {
                  return [(() => {
                    var _el$46 = _tmpl$14();
                    _el$46.$$click = () => void run("remove:" + u.id, async () => {
                      await props.onRemove(u.id);
                      setConfirmRemove(null);
                    }, t("removedOk"));
                    insert(_el$46, () => t("removeConfirm"));
                    effect(() => _el$46.disabled = busy() === "remove:" + u.id);
                    return _el$46;
                  })(), (() => {
                    var _el$47 = _tmpl$12();
                    _el$47.$$click = () => setConfirmRemove(null);
                    insert(_el$47, () => t("cancel"));
                    return _el$47;
                  })()];
                }
              });
            }
          }), null);
          insert(_el$41, createComponent(Show, {
            get when() {
              return pwFor() === u.id;
            },
            get children() {
              var _el$48 = _tmpl$15(), _el$49 = _el$48.firstChild, _el$50 = _el$49.nextSibling, _el$51 = _el$50.nextSibling;
              _el$48.addEventListener("submit", (e) => {
                e.preventDefault();
                const value = pwValue();
                void run("pw:" + u.id, async () => {
                  await props.onSetPassword(u.id, value);
                  setPwFor(null);
                }, t("passwordSetOk")(u, value));
              });
              _el$49.$$input = (e) => setPwValue(e.currentTarget.value);
              insert(_el$50, () => t("apply"));
              _el$51.$$click = () => setPwFor(null);
              insert(_el$51, () => t("cancel"));
              effect(() => _el$50.disabled = busy() === "pw:" + u.id);
              effect(() => _el$49.value = pwValue());
              return _el$48;
            }
          }), null);
          effect(() => className(_el$30, u.banned ? "bg-base-200" : ""));
          return _el$30;
        })()
      )
    }));
    effect(() => className(_el$, "flex flex-col gap-4" + (props.class ? " " + props.class : "")));
    return _el$;
  })();
}
delegateEvents(["input", "click"]);

export { DumbUserManager, suggestPassword };
