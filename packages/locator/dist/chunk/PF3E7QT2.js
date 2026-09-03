// src/index.ts
var LOC_ATTR = "data-loc";
var ENDPOINT = "/__open-in-editor";
function createLocator(options = {}) {
  const attribute = options.attribute ?? LOC_ATTR;
  const endpoint = options.endpoint ?? ENDPOINT;
  const target = options.target ?? window;
  const key = options.key ?? "altKey";
  const onClick = (event) => {
    const click = event;
    if (!click[key] || click.button !== 0) return;
    const node = click.target instanceof Element ? click.target.closest(`[${attribute}]`) : null;
    const loc = node?.getAttribute(attribute);
    if (!loc) return;
    event.preventDefault();
    event.stopPropagation();
    void fetch(`${endpoint}?file=${encodeURIComponent(loc)}`);
  };
  target.addEventListener("click", onClick, { capture: true });
  return () => target.removeEventListener("click", onClick, { capture: true });
}

export { LOC_ATTR, createLocator };
