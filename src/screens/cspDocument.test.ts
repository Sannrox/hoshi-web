// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cspDocument } from "./cspDocument";

afterEach(() => {
  document.adoptedStyleSheets = [];
});

describe("cspDocument", () => {
  it("moves style element text into an adopted sheet and drops it on remove", () => {
    const style = cspDocument(document).createElement("style");
    document.head.append(style);
    style.textContent = ".cell { color: red; }";
    expect(document.adoptedStyleSheets[0]?.cssRules[0]?.cssText).toContain("color: red");
    expect(style.childNodes).toHaveLength(0);
    style.remove();
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });
});
