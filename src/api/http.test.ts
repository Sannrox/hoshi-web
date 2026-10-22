import { describe, expect, it } from "vitest";
import { ApiError, checkServer, HOSHI_CONTRACT, locate, request } from "./http";

const respond =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });

describe("locate", () => {
  it("puts the API two levels above the entry module in production", () => {
    const { apiRoot } = locate("https://host/p/ui/assets/main.js", false);
    expect(apiRoot.href).toBe("https://host/p/");
  });
});

describe("checkServer", () => {
  it("is ready when /healthz lists our contract", async () => {
    const check = await checkServer(
      respond({ ok: true, version: "0.9.0", contract_versions: [HOSHI_CONTRACT], latest: null }),
    );
    expect(check).toStrictEqual({ kind: "ready", version: "0.9.0" });
  });

  it("reports an older server", async () => {
    const check = await checkServer(respond({ ok: true, version: "0.0.1", contract_versions: [] }));
    expect(check.kind).toBe("too-old");
  });
});

describe("request", () => {
  it("sends the bearer token", async () => {
    let seen: string | null = null;
    await request("v1/version", {
      token: "s3cret",
      fetcher: async (_, init) => {
        seen = new Headers(init?.headers).get("authorization");
        return Response.json({ ok: true });
      },
    });
    expect(seen).toBe("Bearer s3cret");
  });

  it("posts a JSON body", async () => {
    let sent: RequestInit | undefined;
    await request("v1/build", {
      body: { planet: "home", building: "metal_mine" },
      fetcher: async (_, init) => {
        sent = init;
        return Response.json({ ok: true });
      },
    });
    expect(sent?.method).toBe("POST");
    expect(sent?.body).toBe('{"planet":"home","building":"metal_mine"}');
  });

  it("carries hoshi's error code and message", async () => {
    const refused = request("v1/version", {
      fetcher: respond(
        { schema_version: 2, ok: false, error: { code: "unauthorized", message: "unauthorized" } },
        401,
      ),
    });
    await expect(refused).rejects.toStrictEqual(new ApiError(401, "unauthorized", "unauthorized"));
  });
});
