import { afterEach, describe, expect, it } from "vitest";
import { assertSameOrigin } from "../lib/actor";

const target = "http://localhost:3000/api/actions/abc/decide";

function post(origin: string | null): Request {
  return new Request(target, {
    method: "POST",
    headers: origin ? { origin } : {},
  });
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("mutation origin guard", () => {
  it("blocks a request that carries no Origin header", () => {
    expect(() => assertSameOrigin(post(null))).toThrow("Cross-origin mutation blocked.");
  });

  it("blocks a request from another site", () => {
    expect(() => assertSameOrigin(post("https://evil.example"))).toThrow(
      "Cross-origin mutation blocked.",
    );
  });

  it("allows an Origin matching the request's own origin", () => {
    expect(() => assertSameOrigin(post("http://localhost:3000"))).not.toThrow();
  });

  it("allows an Origin matching the configured application URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://agentgate.example";

    expect(() => assertSameOrigin(post("https://agentgate.example"))).not.toThrow();
  });

  it("ignores a trailing slash in the configured application URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://agentgate.example/";

    expect(() => assertSameOrigin(post("https://agentgate.example"))).not.toThrow();
  });
});
