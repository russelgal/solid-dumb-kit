**English** · [Русский](README.ru.md)

# Kit MCP server

Gives an agent what it needs to know about `solid-dumb-kit` without reading the
whole repository: which packages exist, what props a component takes, what a
working example looks like, what the docs say, and what this repo forbids.

Zero dependencies — the server runs where the kit's `node_modules` may not exist
at all. Node 18+ is the only requirement.

## Tools

| Tool | What it returns |
| --- | --- |
| `list_packages` | every package: name, version, what it is for |
| `package_api` | the package barrel file in full — in this kit every export carries a comment |
| `component_props` | the props type of a component, JSDoc on each field included |
| `example` | the list of examples, or one example's source; a test keeps them in sync with the API |
| `docs` | a documentation page, English or Russian |
| `rules` | the repo's hard rules: no reflow, imports that survive Solid 2, contrast |
| `search` | search across sources, examples and docs |

## Wiring it up

For a project that **consumes** the kit (so the agent knows the kit's API while
working on someone else's code) — in `.mcp.json` next to its `package.json`:

```json
{
  "mcpServers": {
    "solid-dumb-kit": {
      "command": "node",
      "args": ["/absolute/path/to/solid-dumb-kit/mcp/server.mjs"]
    }
  }
}
```

Or in one command:

```bash
claude mcp add solid-dumb-kit -- node /absolute/path/to/solid-dumb-kit/mcp/server.mjs
```

The path is absolute on purpose: the server derives the repo root from its own
location, so the working directory it is launched from does not matter.

## On another machine

The server's knowledge *is* the repo's files (`packages/*/src`, `docs`,
`examples`, `CLAUDE.md`), so "install one package from npm" does not work here:
a copy of the repository has to be there. The upside is that the server has no
dependencies, so there is nothing to install after cloning — no `npm install`
at all:

```bash
git clone --depth 1 git@github.com:russelgal/solid-dumb-kit.git ~/.solid-dumb-kit
claude mcp add solid-dumb-kit -- node ~/.solid-dumb-kit/mcp/server.mjs
```

The clone takes about 6 MB (the repo carries a built `dist` — consumers install
the packages straight from GitHub and have nothing to build with). Refresh it
with `git -C ~/.solid-dumb-kit pull`.

> **Why not `npx github:russelgal/solid-dumb-kit`.** Tried it — it does not
> work, and MCP is not to blame. Installing from git makes npm pull dev
> dependencies too, and the repo root has a couple of dozen of them written as
> `workspace:*` — a protocol pnpm understands and npm does not, so the install
> dies with `EUNSUPPORTEDPROTOCOL`. The only fix would be dropping `workspace:*`
> from the root, i.e. breaking a working setup for the sake of one command.

If the kit is edited on this machine anyway, point at your working copy rather
than a separate clone: the server then answers with unreleased edits, on
whatever branch you are on.

## Hosted: one URL, nothing installed

The same server also speaks HTTP, and then neither a clone nor Node is needed on
the machine at all:

```bash
claude mcp add --transport http solid-dumb-kit https://solid-dumb-kit.vercel.app/mcp
```

The component playground lives on the same domain (`/`), the server on `/mcp`,
and a landing page with this command on `/mcp-info`.

Its data there is a snapshot of the repo (`mcp/snapshot.json`) built at deploy
time: there is no disk with the repository on a host. The snapshot is rebuilt on
every push to `main`, so the answers keep up with the repo on their own. It
naturally does not see unreleased edits — for work on the kit itself, run the
stdio version against your working copy.

### Deploying to Vercel

The project is linked to the repository, so deploying is not a separate step:
a push to `main` rebuilds both the playground and the snapshot. By hand — only
to ship something uncommitted:

```bash
npx vercel --prod --yes --archive=tgz
```

`--archive=tgz` is not cosmetic: without it the CLI walks hundreds of megabytes
of `node_modules` and hangs.

Pick **Other** for the framework: the build is described in `vercel.json`
(`buildCommand: node mcp/snapshot.mjs`, dependency installation disabled — there
are none). Then link the project to the GitHub repo and the snapshot rebuilds
itself on every push.

The endpoint is open: the kit is public anyway, there is nothing to hide. Should
something private appear, close it with a header check in `api/mcp.mjs` — no
separate build needed for that.

### What is where

| File | Purpose |
| --- | --- |
| `mcp/tools.mjs` | the tools themselves — shared by stdio and HTTP |
| `mcp/sources.mjs` | where knowledge comes from: repo files or a snapshot |
| `mcp/server.mjs` | the stdio transport |
| `api/mcp.mjs` | the HTTP transport (a Vercel function) |
| `mcp/snapshot.mjs` | building the snapshot |

The HTTP transport is deliberately the simplest one: a POST with a single
JSON-RPC message, a single JSON back. No sessions, no SSE — on serverless every
request lands in its own instance, there is nothing to keep state in anyway, and
the tools do not need any.

## Checking it

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node mcp/server.mjs
```

Two JSON lines come back: the server's greeting and the tool list. Anything
meant for humans goes to `stderr` — `stdout` belongs to the protocol.
