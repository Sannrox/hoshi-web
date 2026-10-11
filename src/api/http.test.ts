import { describe, expect, it } from "vitest";
import { HOSHI_CONTRACT } from "./hoshi.gen";
import { checkServer, locate } from "./http";

const respond =
  (body: unknown): typeof fetch =>
  async () =>
    Response.json(body);

describe("locate", () => {
  it("puts the API two levels above the entry module in production", () => {
    const { apiRoot } = locate("https://host/p/ui/assets/main.js", false);
    expect(apiRoot.href).toBe("https://host/p/");
  });
});

describe("checkServer", () => {
  it("is ready when the server lists our contract", async () => {
    const check = await checkServer(respond({ contracts: [HOSHI_CONTRACT], version: "0.1.0" }));
    expect(check).toStrictEqual({ kind: "ready", version: "0.1.0" });
  });

  it("reports an older server", async () => {
    const check = await checkServer(respond({ contracts: [], version: "0.0.1" }));
    expect(check.kind).toBe("too-old");
  });
});
