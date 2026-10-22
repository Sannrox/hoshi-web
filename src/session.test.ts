import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "./api/http";
import { useSession, verifyToken } from "./session";

beforeEach(() => useSession.setState({ token: undefined, ended: undefined }));

describe("session", () => {
  it("keeps the token until sign-out", () => {
    useSession.getState().signIn("abc");
    expect(useSession.getState().token).toBe("abc");
    useSession.getState().signOut();
    expect(useSession.getState()).toMatchObject({ token: undefined, ended: "signed-out" });
  });

  it("records a refused token", () => {
    useSession.getState().signIn("abc");
    useSession.getState().signOut("refused");
    expect(useSession.getState().ended).toBe("refused");
  });
});

describe("verifyToken", () => {
  it("rejects a token hoshi refuses", async () => {
    const body = { schema_version: 2, ok: false, error: { code: "unauthorized", message: "no" } };
    const refused = verifyToken("bad", async () => Response.json(body, { status: 401 }));
    await expect(refused).rejects.toBeInstanceOf(ApiError);
  });
});
