// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearState, loadState, saveState } from "./lastState";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("last state", () => {
  it("round-trips the state and when it was fetched, until cleared", () => {
    saveState({ ok: true }, 42);
    expect(loadState()).toStrictEqual({ raw: { ok: true }, fetchedAt: 42 });
    clearState();
    expect(loadState()).toBeUndefined();
  });

  it("works without storage, as in some private windows", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => saveState({ ok: true }, 1)).not.toThrow();
    expect(loadState()).toBeUndefined();
  });
});
