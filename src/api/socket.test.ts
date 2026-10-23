import { describe, expect, it } from "vitest";
import { bearerProtocols, socketUrl } from "./socket";

describe("socketUrl", () => {
  it("keeps a proxy prefix and switches to wss under https", () => {
    expect(socketUrl("v1/terminal", new URL("https://host/p/")).href).toBe(
      "wss://host/p/v1/terminal",
    );
  });
});

describe("bearerProtocols", () => {
  it("sends the token base64url-encoded without padding next to hoshi.v1", () => {
    expect(bearerProtocols("a?b>")).toStrictEqual(["hoshi.v1", "hoshi.bearer.YT9iPg"]);
  });
});
