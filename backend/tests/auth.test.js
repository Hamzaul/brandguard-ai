import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { createMemoryStore } from "../src/store/store.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../src/auth/crypto.js";

let server, base;
before(async () => {
  const app = createApp({ store: createMemoryStore(), jwtSecret: "test-secret-test-secret" });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const signup = (name, email) => call("POST", "/api/auth/signup", { body: { name, email, password: "Passw0rdOK" } });

test("password hashing: correct passes, wrong/empty/malformed hashes are rejected", async () => {
  const hash = await hashPassword("Secret123");
  assert.equal(await verifyPassword("Secret123", hash), true);
  assert.equal(await verifyPassword("Secret124", hash), false);
  for (const bad of ["", null, undefined, "scrypt$$", "scrypt$aa$bb", "plain"]) {
    assert.equal(await verifyPassword("Secret123", bad), false);
    assert.equal(await verifyPassword("", bad), false);
  }
});

test("jwt: valid, tampered, wrong secret and expired tokens", () => {
  const token = signToken({ sub: "1" }, "s");
  assert.equal(verifyToken(token, "s").sub, "1");
  assert.equal(verifyToken(token, "other"), null);
  const [h, b, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "1", role: "manager", exp: 9999999999 })).toString("base64url");
  assert.equal(verifyToken(`${h}.${forged}.${sig}`, "s"), null);
  assert.equal(verifyToken(signToken({ sub: "1" }, "s", -10), "s"), null);
  assert.equal(verifyToken("garbage", "s"), null);
});

test("health and sample profile stay public", async () => {
  assert.equal((await call("GET", "/api/health")).status, 200);
  assert.equal((await call("GET", "/api/brand/sample")).status, 200);
});

test("signup validation and duplicate email", async () => {
  assert.equal((await call("POST", "/api/auth/signup", { body: { name: "A", email: "x", password: "1" } })).status, 400);
  assert.equal((await call("POST", "/api/auth/signup", { body: { name: "Ann", email: "ann@x.com", password: "onlyletters" } })).status, 400);
  const first = await signup("Manager One", "boss@x.com");
  assert.equal(first.status, 201);
  assert.equal(first.data.user.role, "manager"); // first account bootstraps as manager
  assert.equal(first.data.user.passwordHash, undefined);
  const dup = await signup("Again", "BOSS@x.com");
  assert.equal(dup.status, 409);
});

test("login: success, wrong password and unknown email look the same", async () => {
  const ok = await call("POST", "/api/auth/login", { body: { email: "boss@x.com", password: "Passw0rdOK" } });
  assert.equal(ok.status, 200);
  const wrong = await call("POST", "/api/auth/login", { body: { email: "boss@x.com", password: "nope12345" } });
  const unknown = await call("POST", "/api/auth/login", { body: { email: "who@x.com", password: "nope12345" } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.data.error.message, unknown.data.error.message);
});

test("/api/review needs a valid token but returns the same shape when signed in", async () => {
  assert.equal((await call("POST", "/api/review", { body: { text: "hi" } })).status, 401);
  assert.equal((await call("POST", "/api/review", { token: "bad.token.here", body: { text: "hi" } })).status, 401);
  const { data } = await call("POST", "/api/auth/login", { body: { email: "boss@x.com", password: "Passw0rdOK" } });
  const review = await call("POST", "/api/review", { token: data.token, body: { text: "This is the BEST product ever!!!" } });
  assert.equal(review.status, 200);
  assert.ok(Array.isArray(review.data.issues));
  assert.equal(review.data.analysisMode, "rules_only");
});

test("roles, approval workflow and compliance score", async () => {
  const manager = (await call("POST", "/api/auth/login", { body: { email: "boss@x.com", password: "Passw0rdOK" } })).data;
  const creator = (await signup("Cara Creator", "cara@x.com")).data;
  const other = (await signup("Omar Other", "omar@x.com")).data;
  assert.equal(creator.user.role, "creator");

  // authorization
  assert.equal((await call("GET", "/api/users", { token: creator.token })).status, 403);
  assert.equal((await call("GET", "/api/insights", { token: creator.token })).status, 403);
  assert.equal((await call("GET", "/api/users")).status, 401);
  assert.equal((await call("GET", "/api/users", { token: manager.token })).data.users.length, 3);
  assert.equal((await call("PATCH", `/api/users/${other.user.id}/role`, { token: creator.token, body: { role: "manager" } })).status, 403);
  assert.equal((await call("PATCH", `/api/users/${manager.user.id}/role`, { token: manager.token, body: { role: "creator" } })).status, 400);
  assert.equal((await call("PATCH", `/api/users/${other.user.id}/role`, { token: manager.token, body: { role: "boss" } })).status, 400);
  const promoted = await call("PATCH", `/api/users/${other.user.id}/role`, { token: manager.token, body: { role: "reviewer" } });
  assert.equal(promoted.data.user.role, "reviewer");
  // role change applies to the already-issued token
  assert.equal((await call("GET", "/api/insights", { token: other.token })).status, 200);

  // submit
  assert.equal((await call("POST", "/api/submissions", { token: creator.token, body: { text: "  " } })).status, 400);
  const created = await call("POST", "/api/submissions", { token: creator.token, body: { title: "Launch post", text: "This is the BEST product ever!!!" } });
  assert.equal(created.status, 201);
  const sub = created.data.submission;
  assert.equal(sub.status, "pending");
  assert.ok(sub.score >= 0 && sub.score < 100);

  // visibility: creator sees own, a different creator does not
  const stranger = (await signup("Sam Stranger", "sam@x.com")).data;
  assert.equal((await call("GET", `/api/submissions/${sub.id}`, { token: stranger.token })).status, 404);
  assert.equal((await call("GET", "/api/submissions", { token: stranger.token })).data.submissions.length, 0);
  assert.equal((await call("GET", "/api/submissions", { token: other.token })).data.submissions.length, 1);

  // decisions
  assert.equal((await call("POST", `/api/submissions/${sub.id}/decision`, { token: creator.token, body: { decision: "approve" } })).status, 403);
  assert.equal((await call("POST", `/api/submissions/${sub.id}/decision`, { token: other.token, body: { decision: "request_changes" } })).status, 400); // needs comment
  const changes = await call("POST", `/api/submissions/${sub.id}/decision`, { token: other.token, body: { decision: "request_changes", comment: "Tone it down." } });
  assert.equal(changes.data.submission.status, "changes_requested");
  assert.equal((await call("POST", `/api/submissions/${sub.id}/decision`, { token: other.token, body: { decision: "approve" } })).status, 409);

  // resubmit (owner only)
  assert.equal((await call("PUT", `/api/submissions/${sub.id}`, { token: stranger.token, body: { text: "x" } })).status, 404);
  const again = await call("PUT", `/api/submissions/${sub.id}`, { token: creator.token, body: { text: "A calm, clear product update." } });
  assert.equal(again.data.submission.status, "pending");
  assert.ok(again.data.submission.score >= sub.score);
  assert.equal(again.data.submission.decisions.length, 1); // history kept

  // a reviewer cannot approve their own work
  const own = (await call("POST", "/api/submissions", { token: other.token, body: { text: "Hello team." } })).data.submission;
  assert.equal((await call("POST", `/api/submissions/${own.id}/decision`, { token: other.token, body: { decision: "approve" } })).status, 403);

  const approved = await call("POST", `/api/submissions/${sub.id}/decision`, { token: manager.token, body: { decision: "approve", comment: "Good." } });
  assert.equal(approved.data.submission.status, "approved");

  // insights
  const insights = (await call("GET", "/api/insights", { token: manager.token })).data;
  assert.equal(insights.total, 2);
  assert.equal(insights.approved, 1);
  assert.ok(Array.isArray(insights.activity) && insights.activity.length >= 4);
  assert.equal((await call("GET", "/api/insights", { token: other.token })).data.activity, undefined); // activity log is manager-only
});

test("without JWT_SECRET auth fails clearly instead of being insecure", async () => {
  const app = createApp({ store: createMemoryStore(), jwtSecret: "" });
  const s = await new Promise((resolve) => { const x = app.listen(0, () => resolve(x)); });
  const res = await fetch(`http://127.0.0.1:${s.address().port}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ann", email: "a@x.com", password: "Passw0rdOK" }),
  });
  assert.equal(res.status, 503);
  s.close();
});
