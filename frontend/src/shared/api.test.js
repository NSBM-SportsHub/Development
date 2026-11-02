import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

let client;
let requests;
let responses;
let instance = 0;

function json(data, status = 200, error = null) {
  return Response.json({ data, error }, { status });
}

beforeEach(async (context) => {
  // Each case starts with a fresh session cache, as a new browser page would.
  client = await import(`./api.js?test=${++instance}`);
  requests = [];
  responses = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, ...options });
    assert.ok(responses.length, `Unexpected request to ${url}`);
    return responses.shift();
  });
});

describe("shared API integration contract", () => {
  it("records a match result with PUT, cookies and the token renewed by login", async () => {
    const result = { home_score: 2, away_score: 1 };
    responses.push(
      json({ user: null, csrf_token: "anonymous-token" }),
      json({ user: { id: 1, role: "admin" }, csrf_token: "signed-in-token" }),
      json({ id: 7, ...result }),
    );

    await client.api.post("/auth/login", { email: "admin@example.test", password: "test-password" });
    assert.deepEqual(await client.api.put("/matches/7/result", result), { id: 7, ...result });
    assert.deepEqual(requests.map(({ url }) => url), [
      "/api/auth/session", "/api/auth/login", "/api/matches/7/result",
    ]);
    assert.equal(requests[1].headers["X-CSRF-Token"], "anonymous-token");
    assert.equal(requests[2].method, "PUT");
    assert.equal(requests[2].credentials, "include");
    assert.equal(requests[2].headers["Content-Type"], "application/json");
    assert.equal(requests[2].headers["X-CSRF-Token"], "signed-in-token");
    assert.deepEqual(JSON.parse(requests[2].body), result);
  });

  it("accepts empty cancellation responses and still reads the next resource list", async () => {
    responses.push(
      json({ csrf_token: "session-token" }),
      new Response(null, { status: 204 }),
      json({ bookings: [] }),
    );
    assert.equal(await client.api.delete("/bookings/7"), null);
    assert.deepEqual(await client.api.get("/bookings"), { bookings: [] });
    assert.equal(requests[1].method, "DELETE");
    assert.equal(requests[1].headers["X-CSRF-Token"], "session-token");
  });

  it("preserves field errors so module forms can show server validation", async () => {
    responses.push(
      json({ csrf_token: "session-token" }),
      json(null, 422, {
        code: "validation_failed", message: "Check the result.", fields: { home_score: "Enter a valid score." },
      }),
    );
    await assert.rejects(client.api.put("/matches/7/result", { home_score: -1 }), (error) => {
      assert.ok(error instanceof client.ApiError);
      assert.equal(error.status, 422);
      assert.equal(error.code, "validation_failed");
      assert.deepEqual(error.fields, { home_score: "Enter a valid score." });
      return true;
    });
  });

  it("clears expired authentication and obtains a new token for the next write", async () => {
    let signedOut = false;
    client.onUnauthorized(() => { signedOut = true; });
    responses.push(
      json({ csrf_token: "old-token" }),
      json(null, 401, { code: "unauthenticated", message: "Sign in again." }),
      json({ csrf_token: "new-token" }),
      json({ user: { id: 1 }, csrf_token: "login-token" }),
    );
    await client.getSession();
    await assert.rejects(client.api.get("/memberships"), { status: 401 });
    assert.equal(signedOut, true);
    await client.api.post("/auth/login", { email: "student@example.test", password: "test-password" });
    assert.equal(requests[2].url, "/api/auth/session");
    assert.equal(requests[3].headers["X-CSRF-Token"], "new-token");
  });
});
