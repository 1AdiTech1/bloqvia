import assert from "node:assert/strict";
import { test } from "node:test";
import { originAllowed } from "../src/http.js";

const allowed = ["http://localhost:8080", "https://*.lovable.app", "https://bloqvia.com"];

test("exact origins and wildcard subdomains are allowed", () => {
  assert.ok(originAllowed("http://localhost:8080", allowed));
  assert.ok(originAllowed("https://bloqvia.com", allowed));
  assert.ok(originAllowed("https://id-preview--1ace3ff8.lovable.app", allowed));
  assert.ok(originAllowed("https://bloqvia.lovable.app", allowed));
});

test("other origins are refused", () => {
  assert.equal(originAllowed("https://lovable.app", allowed), false);
  assert.equal(originAllowed("http://bloqvia.lovable.app", allowed), false);
  assert.equal(originAllowed("https://evil.com", allowed), false);
  assert.equal(originAllowed("https://notbloqvia.com", allowed), false);
});
