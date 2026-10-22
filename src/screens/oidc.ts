/**
 * Identity login through hoshi's server-side flow.
 *
 * hoshi runs Authorization Code with PKCE itself: `/v1/oidc/start` redirects to
 * the identity provider, and `/v1/oidc/callback` mints a bearer token and shows
 * it as JSON. The client opens that flow in a window and reads the JSON back
 * when the callback lands on its own origin. Elsewhere, for example behind a
 * proxy prefix, the browser forbids the read and the player pastes the token.
 */

export type CallbackResult =
  | { kind: "token"; token: string }
  | { kind: "refused"; message: string };

type Body = { ok?: unknown; token?: unknown; error?: { message?: unknown } };

/** Read hoshi's callback JSON (or its error JSON) from page text; `undefined` when it is not there yet. */
export const parseCallback = (text: string): CallbackResult | undefined => {
  let body: Body;
  try {
    body = JSON.parse(text) as Body;
  } catch {
    return undefined;
  }
  if (body.ok === true && typeof body.token === "string" && body.token) {
    return { kind: "token", token: body.token };
  }
  if (body.ok === false) {
    const message = body.error?.message;
    return { kind: "refused", message: typeof message === "string" ? message : "refused" };
  }
  return undefined;
};

/** The parts of the login window this flow touches. */
export type LoginWindow = {
  readonly closed: boolean;
  readonly document: Document;
  close: () => void;
};

/** Page text candidates: browsers wrap raw JSON in a `<pre>`, some add viewer chrome. */
const readWindow = (login: LoginWindow): CallbackResult | undefined => {
  let texts: string[];
  try {
    const doc = login.document;
    texts = [...doc.querySelectorAll("pre")].map((pre) => pre.textContent);
    texts.push(doc.body?.textContent ?? "");
  } catch {
    return undefined;
  }
  for (const text of texts) {
    const result = parseCallback(text.trim());
    if (result) {
      return result;
    }
  }
  return undefined;
};

/**
 * Watch the login window until hoshi's callback shows a result, the player
 * closes it, or `signal` aborts. Reading a cross-origin page throws, which
 * counts as "not there yet".
 */
export const watchLogin = (login: LoginWindow, signal: AbortSignal, everyMs = 500) =>
  new Promise<CallbackResult | "closed">((resolve) => {
    const timer = setInterval(() => {
      if (signal.aborted || login.closed) {
        clearInterval(timer);
        resolve("closed");
        return;
      }
      const result = readWindow(login);
      if (result) {
        clearInterval(timer);
        login.close();
        resolve(result);
      }
    }, everyMs);
  });
