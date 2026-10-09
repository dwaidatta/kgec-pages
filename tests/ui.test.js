import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { showToast } from "../website/lib/ui.js";

beforeEach(() => {
  globalThis.__toasts.length = 0;
});

test("showToast shows a toast with the requested variant", () => {
  showToast("Saved", "success");
  assert.equal(globalThis.__toasts.length, 1);
  assert.match(globalThis.__toasts[0], /kg-toast-success/);
});

test("showToast defaults to the primary variant", () => {
  showToast("Hello");
  assert.match(globalThis.__toasts[0], /kg-toast-primary/);
});
