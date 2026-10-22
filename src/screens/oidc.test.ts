// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { type LoginWindow, parseCallback, watchLogin } from "./oidc";

describe("parseCallback", () => {
  it("reads the token hoshi minted", () => {
    const text = '{"schema_version":2,"ok":true,"token":"abc"}';
    expect(parseCallback(text)).toStrictEqual({ kind: "token", token: "abc" });
  });

  it("reads a refusal", () => {
    const text = '{"schema_version":2,"ok":false,"error":{"code":"invalid","message":"not found"}}';
    expect(parseCallback(text)).toStrictEqual({ kind: "refused", message: "not found" });
  });

  it("ignores pages that are not hoshi JSON", () => {
    expect(parseCallback("Sign in to continue")).toBeUndefined();
  });
});

/** A login window that stays cross-origin until `land` puts hoshi's JSON on it. */
const fakeWindow = () => {
  let page: string | undefined;
  const win = {
    closed: false,
    get document(): Document {
      if (page === undefined) {
        throw new DOMException("Blocked a frame", "SecurityError");
      }
      const doc = document.implementation.createHTMLDocument();
      const pre = doc.createElement("pre");
      pre.textContent = page;
      doc.body.append(pre);
      return doc;
    },
    close() {
      win.closed = true;
    },
  };
  return { win: win satisfies LoginWindow, land: (json: string) => (page = json) };
};

describe("watchLogin", () => {
  it("waits through the identity provider, then reads the token and closes the window", async () => {
    const { win, land } = fakeWindow();
    const result = watchLogin(win, new AbortController().signal, 1);
    setTimeout(() => land('{"ok":true,"token":"abc"}'), 5);
    await expect(result).resolves.toStrictEqual({ kind: "token", token: "abc" });
    expect(win.closed).toBe(true);
  });

  it("stops when the player closes the window", async () => {
    const { win } = fakeWindow();
    const result = watchLogin(win, new AbortController().signal, 1);
    win.close();
    await expect(result).resolves.toBe("closed");
  });
});
