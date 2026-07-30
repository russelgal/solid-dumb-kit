**English** · [Русский](ru/Odata1C.md)

# Odata1C

A tiny client for the **1C standard OData interface** (`standard.odata`). Framework-free and isomorphic — it needs `fetch`, `TextEncoder` and `btoa`, so it runs in the browser and in Node 18+ alike. No SolidJS, no DOM.

```ts
import { createOdataClient, odataString, OdataError } from 'solid-dumb-kit'

const c = createOdataClient({ baseUrl: '/odata', login: 'Кладовщик', password: '…' })

const items = await c.list('Catalog_Номенклатура', {
  $select: 'Ref_Key,Description,Артикул',
  $filter: `substringof(${odataString('скотч')}, Description)`,
  $top: 20,
})
```

The point of this client is not the ten lines of `fetch` around a URL — it is the pile of 1C quirks baked into those lines. Each one below cost someone an afternoon.

## Why not plain `fetch`

| Quirk | What happens without the client |
| --- | --- |
| `$format=application/json;odata=nometadata` must be on **every** request | The response leaks the internal address of the 1C server in every `odata.metadata` field. The `Accept` header is ignored by the platform, so the query param is the only lever. |
| Spaces must be percent-encoded as `%20`, never `+` | `URLSearchParams` writes `+`, and 1C **silently ignores** the whole `$filter` — you get an unfiltered set and no error at all. |
| Errors arrive as an `odata.error` object, sometimes behind a BOM | `JSON.parse` throws on the BOM, and a 200 response carrying `odata.error` looks like success. |
| `$filter`/`$orderby` may be forbidden by role permissions | «Операция не разрешена в предложении "ГДЕ"» — a 400 with a Russian message where you expected rows. See [`tailPage`](#tailpage--paging-a-set-you-cannot-sort). |
| Cyrillic logins | `btoa` throws on non-Latin-1 input; the token has to be built through UTF-8 bytes. |

## Setup

```ts
type OdataClientOptions = {
  baseUrl: string        // 'https://host/base/odata/standard.odata' or a proxy path like '/odata'
  login?: string         // Basic auth …
  password?: string
  token?: string         // … or a ready base64(login:password)
  fetch?: typeof fetch   // your own fetch — logging, retries, counters
  timeoutMs?: number     // default 30000
}
```

**CORS.** The 1C platform sends no CORS headers, so a browser cannot call it directly across origins. Point `baseUrl` at a relative path (`/odata`) and let your dev server or nginx proxy it — that is also why `baseUrl` is allowed to be relative.

**Credentials.** `token` exists so you never have to keep the password around: store `base64(login:password)` (that is all Basic auth is) or, better, keep the whole thing server-side and expose your own endpoint.

## API

| Method | Request it makes |
| --- | --- |
| `url(resource, params?)` | Builds the URL only — handy for logging and for tests. |
| `request<T>(resource, params?, init?)` | The workhorse: any method, optional JSON body. |
| `get<T>(resource, params?)` | `GET` of an entity or a set, raw response. |
| `list<T>(resource, params?)` | `GET` of a set → the `value` array (`[]` when absent). |
| `one<T>(entity, refKey, select?)` | `GET Entity(guid'…')` — a single record by key. |
| `count(resource, filter?)` | `$top=0&$inlinecount=allpages` → exact row count. |
| `tailPage<T>(resource, opts)` | A page from the end of a set, newest first. |

Everything rejects with `OdataError` (`message` from 1C, `status` when there was an HTTP response). A `401` is normalised to a readable «Неверный логин или пароль 1С».

### `one` — reading past a locked-down role

`Entity(guid'…')` addresses a record by primary key rather than by a `WHERE` clause, so it keeps working in bases where `$filter` is forbidden for the role. When you need names for a batch of keys, that turns into one request per key — cache them, and cap the concurrency.

### `tailPage` — paging a set you cannot sort

Chronological sets (documents, register records) are stored oldest-first, and `$orderby Date desc` is exactly what a locked-down role tends to reject. `tailPage` sidesteps sorting altogether: ask for the total, take the last `pageSize` rows via `$skip`, reverse them client-side.

```ts
const { rows, total } = await c.tailPage('Document_РеализацияТоваровУслуг', {
  page: 1,                       // 1 = newest
  pageSize: 20,
  select: 'Ref_Key,Number,Date,Posted',
  filter: `substringof(${odataString(term)}, Number)`,   // applied to both the count and the page
})
```

Costs two requests per page (count + rows). The count is the price of not being able to sort.

## Helpers

| Function | What for |
| --- | --- |
| `odataString(s)` | Wraps a value in apostrophes and doubles the inner ones. Always run user input through it. |
| `toBase64(s)` | UTF-8-safe base64 — what makes Cyrillic logins work. |

Literals 1C insists on: dates as `datetime'2026-04-01T00:00:00'`, references as `guid'…'`, a register's recorder as `cast(guid'…', 'Document_…')`.

## Watch out

- **URL length.** nginx in front of 1C answers `414` at roughly 8000 characters, and Cyrillic entity names take six characters each once encoded. A filter built from ~30 `or`-ed keys already gets close — chunk long key lists into batches of ~25 and merge the results.
- **One list beats a thousand point reads.** A whole catalogue (tens of thousands of rows, `Ref_Key` + a couple of fields) usually comes back in about a second in a single request. If you need names for hundreds of keys, download the dictionary once and cache it.
- **`$select` is not an optimisation, it is a necessity.** Without it a register hands you every single resource it has, and the response balloons.
- **Writing.** `POST` returns `201` with the created object, `PATCH` `200`, `DELETE` `204` (empty body — the client returns `undefined`). Posting a document is a `POST` to `Document_…(guid'…')/Post()`. 1C guards closed periods itself.

## Example

[`examples/Odata1C.example.tsx`](../examples/Odata1C.example.tsx) — the URL builder runs offline (type a filter, watch the request take shape); the live request fires only on a button press.
