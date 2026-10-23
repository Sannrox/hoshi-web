/**
 * A `document` for xterm's `documentOverride` that keeps it working under
 * `Content-Security-Policy: default-src 'self'` (see README, "How it ships").
 *
 * xterm writes its theme and cell size as CSS text into `<style>` elements,
 * which that policy refuses. CSSOM writes are not governed by CSP, so the text
 * goes into constructed sheets on `adoptedStyleSheets` instead. xterm's DOM
 * renderer also colours cells with style attributes, through the global
 * `document`; `Terminal.tsx` draws with WebGL so those cells never exist.
 */
export const cspDocument = (doc: Document): Document => {
  const adopt = (style: HTMLStyleElement) => {
    const sheet = new CSSStyleSheet();
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    Object.defineProperty(style, "textContent", {
      get: () => [...sheet.cssRules].map((rule) => rule.cssText).join("\n"),
      set: (css: string | null) => sheet.replaceSync(css ?? ""),
    });
    const remove = style.remove.bind(style);
    style.remove = () => {
      doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((kept) => kept !== sheet);
      remove();
    };
  };

  const createElement = (tag: string, options?: ElementCreationOptions) => {
    const element = doc.createElement(tag, options);
    if (element instanceof HTMLStyleElement) {
      adopt(element);
    }
    return element;
  };

  return new Proxy(doc, {
    get: (target, key) => {
      if (key === "createElement") {
        return createElement;
      }
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};
