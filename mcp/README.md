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

## Checking it

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node mcp/server.mjs
```

Two JSON lines come back: the server's greeting and the tool list. Anything
meant for humans goes to `stderr` — `stdout` belongs to the protocol.
