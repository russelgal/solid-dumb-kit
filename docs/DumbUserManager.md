**English** · [Русский](ru/DumbUserManager.md)

# DumbUserManager

An admin screen: grant access, change a role, ban, set a password, revoke
sessions, delete.

```tsx
import { DumbUserManager, suggestPassword, type UserRow } from '@solid-dumb-kit/user-manager'
```

## It has no idea what is behind it

Not better-auth, not your endpoint, not a database. Everything goes through
callbacks, and every one of them is optional: no `onRemove` — no "Delete"
button. The same screen serves an administrator and someone who may only look at
the list.

```tsx
<DumbUserManager
  users={users()}
  roles={[{ value: 'admin', label: 'Administrator', hint: 'everything' }]}
  currentUserId={me()?.id}
  onCreate={async (input) => { await api.createUser(input); await reload() }}
  onSetRole={async (id, role) => { await api.setRole(id, role); await reload() }}
/>
```

## Four decisions made for you

1. **A password is shown once.** Creating a user and setting a password return it
   in a banner — there is no second chance to read it, and the text says so. An
   empty password field means "generate one" (`suggestPassword`).
2. **The owner is off limits.** `isOwner` disables the buttons on the client —
   not as protection (that lives on the server), but to avoid offering an action
   that is certain to be refused.
3. **You cannot ban or delete yourself.** Same reasoning: the server would
   refuse, so the button is disabled with a hint explaining why.
4. **Deleting takes two clicks, not a `confirm()`.** The browser dialog blocks
   everything, while a second button next to the row is clearer and is dismissed
   by clicking elsewhere.

A server error is shown **verbatim**: it is written by whoever knows what exactly
went wrong, and an invented "Something went wrong" only helps those who already
guessed.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `users` | `UserRow[]` | what to show; sorting and filtering are yours |
| `roles` | `RoleOption[]` | role dictionary; empty — the role is plain text |
| `currentUserId` | `string` | you may not ban or delete yourself |
| `defaultRole` | `string` | default role in the create form |
| `onCreate` | `(input) => Promise<void>` | omitted — no "grant access" form |
| `onSetRole` | `(id, role) => Promise<void>` | omitted — the role is plain text |
| `onSetPassword` | `(id, password) => Promise<void>` | the "Password" button on a row |
| `onBan` | `(id, reason) => Promise<void>` | suspend access |
| `onUnban` | `(id) => Promise<void>` | restore access |
| `onRevokeSessions` | `(id) => Promise<void>` | end every session |
| `onRemove` | `(id) => Promise<void>` | delete, confirmed inside the row |
| `formatDate` | `(iso: string) => string` | creation date; as received by default |
| `title` | `string` | heading; an empty string means no heading |
| `labels` | `UserManagerLabels` | every string; the defaults are Russian |
| `class` | `string` | classes on the root: spacing and width are yours |

## Styling

Styling is **daisyUI**: `btn`, `input`, `select`, `table`, `alert`, `badge`.
The package ships no CSS of its own, and that is deliberate: an admin screen
lives inside your application and has to look like a part of it, not like a
guest in someone else's theme. Theme, corner radius and colours come from your
daisyUI — there is nothing to change here.

So Tailwind and daisyUI are required on the consumer side. Spacing and width are
yours: the `class` prop goes onto the root.

A banned row is marked with **background** (`bg-base-200`), not opacity: faded
text is banned in this kit, and the row still has to be readable — what it was
banned for is in the tooltip.

## Passwords

`suggestPassword(length = 9)` is exported separately, free of Solid: useful in a
seeding script or a test too. Pairs that are confused by ear and on paper are
removed from the alphabet (`0/O/o`, `1/l/I`, `B/8`, `Z/2`) — the password gets
dictated aloud and copied off the screen. Capitals are kept: otherwise it fails
the "must contain an uppercase letter" check. Bytes are drawn with rejection
rather than a modulo, so the generator is not biased towards the start of the
alphabet.
